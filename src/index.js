'use strict';

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const https = require('https');
const axios = require('axios');

const { loadConfig, saveConfig } = require('./config');
const { listLights, discoverHub, createClient } = require('./dirigera');
const { fetchSchedule, fetchUpcomingSchedule } = require('./collectors/avalex');
const { activateNotification, dismissNotification, getActiveNotification } = require('./notification');
const { startScheduler } = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ---------- Pairing state (in-memory) ----------
let pairingState = null;

// ---------- PKCE helpers ----------
function generateVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// ---------- API Routes ----------

// Discover hub
app.get('/api/setup/discover', async (req, res) => {
  try {
    const hubUrl = await discoverHub();
    res.json({ hubUrl });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// Initiate pairing
app.post('/api/setup/pair', async (req, res) => {
  try {
    const { hubUrl } = req.body;
    if (!hubUrl) {
      return res.status(400).json({ error: 'hubUrl is required' });
    }

    const verifier = generateVerifier();
    const challenge = generateChallenge(verifier);

    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const authorizeUrl = `${hubUrl}/v1/oauth/authorize?audience=homesmart.local&response_type=code&code_challenge=${challenge}&code_challenge_method=S256`;

    let codeResponse;
    try {
      const res2 = await axios.get(authorizeUrl, { httpsAgent, timeout: 10000 });
      codeResponse = res2.data;
    } catch (err) {
      if (err.response) {
        return res.status(err.response.status).json({ error: `Hub auth error: ${err.response.status}` });
      }
      return res.status(503).json({ error: `Cannot reach hub: ${err.message}` });
    }

    const code = codeResponse.code;
    if (!code) {
      return res.status(500).json({ error: 'Hub did not return a code', raw: codeResponse });
    }

    // Store state for polling
    pairingState = {
      hubUrl,
      verifier,
      challenge,
      code,
      startedAt: Date.now(),
      status: 'waiting', // waiting | success | failed
      token: null,
      error: null,
    };

    // Start polling in background
    pollForToken(pairingState);

    res.json({ status: 'waiting', message: 'Press the action button on the bottom of the hub, then poll /api/setup/pair/status' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function pollForToken(state) {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const tokenUrl = `${state.hubUrl}/v1/oauth/token`;
  const maxAttempts = 30; // 60 seconds
  let attempts = 0;

  const attempt = async () => {
    if (state.status !== 'waiting') return; // Already resolved
    if (attempts >= maxAttempts) {
      state.status = 'failed';
      state.error = 'Pairing timed out. Please try again.';
      return;
    }
    attempts++;

    try {
      const params = new URLSearchParams({
        code: state.code,
        name: 'trash-day-reminder',
        grant_type: 'authorization_code',
        code_verifier: state.verifier,
      });

      const tokenRes = await axios.post(tokenUrl, params.toString(), {
        httpsAgent,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 5000,
      });

      if (tokenRes.data && tokenRes.data.access_token) {
        state.status = 'success';
        state.token = tokenRes.data.access_token;
        return;
      }
    } catch (err) {
      if (err.response) {
        const status = err.response.status;
        const body = err.response.data || {};
        const errMsg = (body.message || body.error || '').toLowerCase();

        if (errMsg.includes('timed out') || errMsg.includes('invalid') || errMsg.includes('expired')) {
          // Request new code
          try {
            const authorizeUrl = `${state.hubUrl}/v1/oauth/authorize?audience=homesmart.local&response_type=code&code_challenge=${state.challenge}&code_challenge_method=S256`;
            const authRes = await axios.get(authorizeUrl, { httpsAgent, timeout: 5000 });
            if (authRes.data && authRes.data.code) {
              state.code = authRes.data.code;
              console.log('[Pairing] Got new code after expiry, continuing poll');
            }
          } catch (authErr) {
            console.error('[Pairing] Failed to get new code:', authErr.message);
          }
        } else if (status === 400 || status === 401) {
          // Still waiting for button press — normal
        }
      }
      // Continue polling
    }

    // Wait 2 seconds then retry
    setTimeout(attempt, 2000);
  };

  attempt();
}

// Poll pairing status
app.get('/api/setup/pair/status', (req, res) => {
  if (!pairingState) {
    return res.status(404).json({ status: 'none', error: 'No pairing in progress' });
  }

  const response = {
    status: pairingState.status,
    hubUrl: pairingState.hubUrl,
  };

  if (pairingState.status === 'success') {
    response.token = pairingState.token;
  } else if (pairingState.status === 'failed') {
    response.error = pairingState.error;
  }

  res.json(response);
});

// List lights
app.get('/api/setup/lights', async (req, res) => {
  try {
    const config = await loadConfig();
    const hubUrl = req.query.hubUrl || config.hubUrl;
    const token = req.query.token || config.token;

    if (!hubUrl || !token) {
      return res.status(400).json({ error: 'hubUrl and token are required' });
    }

    const lights = await listLights(hubUrl, token);
    const simplified = lights.map((l) => ({
      id: l.id,
      name: l.attributes && l.attributes.customName,
      room: l.room && l.room.name,
      isOn: l.attributes && l.attributes.isOn,
      capabilities: {
        isRgb: l.attributes && (l.attributes.colorHue !== undefined || l.attributes.colorSaturation !== undefined || l.attributes.colorMode !== undefined),
        hasColorTemp: l.attributes && l.attributes.colorTemperature !== undefined,
      },
    }));
    res.json(simplified);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save config
app.post('/api/setup/save', async (req, res) => {
  try {
    const { postalCode, houseNumber, hubUrl, token, roomName, lightName, lightId } = req.body;

    if (!postalCode || !houseNumber) {
      return res.status(400).json({ error: 'postalCode and houseNumber are required' });
    }
    if (!hubUrl || !token) {
      return res.status(400).json({ error: 'hubUrl and token are required' });
    }
    if (!roomName || !lightName) {
      return res.status(400).json({ error: 'roomName and lightName are required' });
    }

    const saved = await saveConfig({ postalCode, houseNumber, hubUrl, token, roomName, lightName, lightId: lightId || null });
    res.json({ success: true, config: { ...saved, token: '***' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update light config
app.patch('/api/config', async (req, res) => {
  try {
    const config = await loadConfig();
    const { roomName, lightName, lightId } = req.body;
    if (!roomName || !lightName) {
      return res.status(400).json({ error: 'roomName and lightName are required' });
    }
    const updated = await saveConfig({ ...config, roomName, lightName, lightId: lightId || null });
    res.json({ success: true, config: { ...updated, token: '***' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get config (without token)
app.get('/api/config', async (req, res) => {
  try {
    const config = await loadConfig();
    res.json({ ...config, token: config.token ? '***' : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get status
app.get('/api/status', async (req, res) => {
  try {
    const config = await loadConfig();
    const isConfigured = !!(config.postalCode && config.houseNumber && config.hubUrl && config.token);

    let upcoming = [];
    if (isConfigured) {
      try {
        upcoming = await fetchUpcomingSchedule(config.postalCode, config.houseNumber);
      } catch (err) {
        console.error('[Status] Failed to fetch schedule:', err.message);
      }
    }

    const activeNotification = getActiveNotification();

    res.json({
      configured: isConfigured,
      postalCode: config.postalCode || null,
      houseNumber: config.houseNumber || null,
      roomName: config.roomName || null,
      lightName: config.lightName || null,
      upcoming,
      activeNotification,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get schedule
app.get('/api/schedule', async (req, res) => {
  try {
    const config = await loadConfig();
    const postalCode = req.query.postalCode || config.postalCode;
    const houseNumber = req.query.houseNumber || config.houseNumber;

    if (!postalCode || !houseNumber) {
      return res.status(400).json({ error: 'postalCode and houseNumber are required' });
    }

    const schedule = await fetchSchedule(postalCode, houseNumber);
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test notification
app.post('/api/notify/test', async (req, res) => {
  try {
    const { wasteType } = req.body;
    const type = wasteType || 'pmd';
    const result = await activateNotification(type, true);
    res.json({ success: true, notification: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dismiss notification
app.delete('/api/notify/dismiss', async (req, res) => {
  try {
    const result = await dismissNotification();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Serve React frontend in production ----------
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

// Catch-all: serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`[Server] Trash Day Reminder running on port ${PORT}`);
  startScheduler();
});

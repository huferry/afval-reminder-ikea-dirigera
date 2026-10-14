'use strict';

const https = require('https');
const axios = require('axios');

// Ignore self-signed cert on Dirigera hub
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

function createClient(hubUrl, token) {
  return axios.create({
    baseURL: `${hubUrl}/v1`,
    httpsAgent,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });
}

async function listDevices(hubUrl, token) {
  const client = createClient(hubUrl, token);
  const res = await client.get('/devices');
  return res.data;
}

async function listLights(hubUrl, token) {
  const devices = await listDevices(hubUrl, token);
  return devices.filter((d) => d.deviceType === 'light');
}

async function getDevice(hubUrl, token, deviceId) {
  const client = createClient(hubUrl, token);
  const res = await client.get(`/devices/${deviceId}`);
  return res.data;
}

async function patchDevice(hubUrl, token, deviceId, attributes) {
  const client = createClient(hubUrl, token);
  const res = await client.patch(`/devices/${deviceId}`, [{ attributes }]);
  return res.status;
}

async function findLightByRoomAndName(hubUrl, token, roomName, lightName) {
  const lights = await listLights(hubUrl, token);
  const match = lights.find(
    (l) =>
      l.room &&
      l.room.name &&
      l.room.name.toLowerCase() === roomName.toLowerCase() &&
      l.attributes &&
      l.attributes.customName &&
      l.attributes.customName.toLowerCase() === lightName.toLowerCase()
  );
  return match || null;
}

async function discoverHub() {
  // Try the fixed IP first
  const candidates = [
    'https://192.168.2.6:8443',
  ];

  for (const url of candidates) {
    try {
      await axios.get(`${url}/v1/users/me`, {
        httpsAgent,
        timeout: 3000,
      });
      return url; // 200 means we're somehow authed
    } catch (err) {
      if (err.response) {
        // Any HTTP response means the hub is there
        return url;
      }
      // Network error — try next
    }
  }
  throw new Error('Could not discover Dirigera hub. Make sure it is on the network at 192.168.2.6:8443');
}

module.exports = { listDevices, listLights, getDevice, patchDevice, findLightByRoomAndName, discoverHub, createClient };

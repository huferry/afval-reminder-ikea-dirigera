import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const STEPS = ['Ontdek hub', 'Koppel hub', 'Adresgegevens', 'Kies lamp', 'Test & Opslaan'];

const styles = {
  container: {
    maxWidth: 560,
    margin: '40px auto',
    padding: '0 16px',
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
    padding: '32px 28px',
    marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: 700, marginBottom: 8 },
  subtitle: { color: '#666', marginBottom: 24, lineHeight: 1.5 },
  stepBar: { display: 'flex', gap: 6, marginBottom: 32 },
  stepDot: (active, done) => ({
    flex: 1,
    height: 6,
    borderRadius: 3,
    background: done ? '#2ecc71' : active ? '#3498db' : '#ddd',
    transition: 'background 0.3s',
  }),
  btn: (variant) => ({
    padding: '10px 24px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 15,
    background: variant === 'primary' ? '#3498db' : variant === 'success' ? '#2ecc71' : '#eee',
    color: variant === 'primary' || variant === 'success' ? '#fff' : '#333',
    marginRight: 8,
    marginTop: 12,
  }),
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 15,
    border: '1.5px solid #ddd',
    borderRadius: 8,
    marginBottom: 12,
    outline: 'none',
  },
  label: { fontWeight: 600, marginBottom: 4, display: 'block', fontSize: 14 },
  error: {
    background: '#fdecea',
    color: '#c0392b',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 12,
    fontSize: 14,
  },
  info: {
    background: '#eaf4fb',
    color: '#1a6a9a',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 12,
    fontSize: 14,
  },
  success: {
    background: '#eafaf1',
    color: '#1e8449',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 12,
    fontSize: 14,
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 15,
    border: '1.5px solid #ddd',
    borderRadius: 8,
    marginBottom: 12,
    background: '#fff',
  },
};

export default function SetupPage({ onConfigured }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  // Step 0: Discover
  const [hubUrl, setHubUrl] = useState('');

  // Step 1: Pair
  const [pairingStarted, setPairingStarted] = useState(false);
  const [token, setToken] = useState('');
  const [pairingStatus, setPairingStatus] = useState(null);

  // Step 2: Address
  const [postalCode, setPostalCode] = useState('');
  const [houseNumber, setHouseNumber] = useState('');

  // Step 3: Light
  const [lights, setLights] = useState([]);
  const [selectedLightId, setSelectedLightId] = useState('');
  const [notificationMode, setNotificationMode] = useState('rgb');

  // Step 4: Test
  const [testResult, setTestResult] = useState(null);
  const [testType, setTestType] = useState('pmd');

  const clearMessages = () => { setError(null); setMessage(null); };

  // ---------- Step 0: Discover hub ----------
  const handleDiscover = async () => {
    clearMessages();
    setLoading(true);
    try {
      const res = await fetch('/api/setup/discover');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Discovery failed');
      setHubUrl(data.hubUrl);
      setMessage(`Hub gevonden op: ${data.hubUrl}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Step 1: Pair ----------
  const handlePair = async () => {
    clearMessages();
    setLoading(true);
    setPairingStarted(true);
    setPairingStatus('waiting');
    try {
      const res = await fetch('/api/setup/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hubUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Pairing request failed');
      setMessage('Druk op de actieknop onderaan de hub en wacht...');
      pollPairingStatus();
    } catch (err) {
      setError(err.message);
      setLoading(false);
      setPairingStarted(false);
    }
  };

  const pollPairingStatus = () => {
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch('/api/setup/pair/status');
        const data = await res.json();
        setPairingStatus(data.status);

        if (data.status === 'success') {
          clearInterval(poll);
          setToken(data.token);
          setMessage('Koppeling succesvol! Token opgeslagen.');
          setLoading(false);
        } else if (data.status === 'failed') {
          clearInterval(poll);
          setError(data.error || 'Koppeling mislukt');
          setLoading(false);
          setPairingStarted(false);
        } else if (attempts > 40) {
          clearInterval(poll);
          setError('Time-out: druk de knop in en probeer opnieuw');
          setLoading(false);
          setPairingStarted(false);
        }
      } catch (e) {
        // ignore transient fetch errors during polling
      }
    }, 2000);
  };

  // ---------- Step 3: Load lights ----------
  useEffect(() => {
    if (step === 3 && hubUrl && token) {
      setLoading(true);
      fetch(`/api/setup/lights?hubUrl=${encodeURIComponent(hubUrl)}&token=${encodeURIComponent(token)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);
          setLights(data);
          if (data.length > 0) setSelectedLightId(data[0].id);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [step]);

  // ---------- Step 4: Test ----------
  const handleTest = async () => {
    clearMessages();
    setLoading(true);
    try {
      const res = await fetch('/api/notify/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wasteType: testType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test failed');
      setTestResult(data.notification);
      setMessage(`Test gelukt! Lamp brandt nu ${data.notification.color}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    clearMessages();
    setLoading(true);
    try {
      const selectedLight = lights.find((l) => l.id === selectedLightId);
      const body = {
        postalCode,
        houseNumber,
        hubUrl,
        token,
        roomName: selectedLight ? selectedLight.room : '',
        lightName: selectedLight ? selectedLight.name : '',
        lightId: selectedLightId,
        notificationMode,
      };

      const res = await fetch('/api/setup/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Opslaan mislukt');
      setMessage('Configuratie opgeslagen!');
      setTimeout(() => {
        if (onConfigured) onConfigured();
        navigate('/');
      }, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const canAdvance = () => {
    if (step === 0) return !!hubUrl;
    if (step === 1) return !!token;
    if (step === 2) return postalCode.length >= 6 && houseNumber.length >= 1;
    if (step === 3) return !!selectedLightId;
    return true;
  };

  const selectedLight = lights.find((l) => l.id === selectedLightId);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.title}>Trash Day Reminder instellen</div>
        <div style={styles.subtitle}>Volg de stappen om de app te configureren.</div>

        <div style={styles.stepBar}>
          {STEPS.map((_, i) => (
            <div key={i} style={styles.stepDot(i === step, i < step)} title={STEPS[i]} />
          ))}
        </div>

        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>
          Stap {step + 1}: {STEPS[step]}
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {message && <div style={step === 1 && pairingStatus === 'success' ? styles.success : styles.info}>{message}</div>}

        {/* ---- STEP 0: Discover ---- */}
        {step === 0 && (
          <div>
            <p>Klik op "Ontdek" om de Dirigera hub op het netwerk te vinden. De hub staat normaal op 192.168.2.6:8443.</p>
            {hubUrl && (
              <div style={{ ...styles.success, marginBottom: 12 }}>
                Hub gevonden: <strong>{hubUrl}</strong>
              </div>
            )}
            <button style={styles.btn('primary')} onClick={handleDiscover} disabled={loading}>
              {loading ? 'Zoeken...' : 'Ontdek hub'}
            </button>
            {!hubUrl && (
              <div style={{ marginTop: 16 }}>
                <label style={styles.label}>Of voer het adres handmatig in:</label>
                <input
                  style={styles.input}
                  value={hubUrl}
                  onChange={(e) => setHubUrl(e.target.value)}
                  placeholder="https://192.168.2.6:8443"
                />
              </div>
            )}
          </div>
        )}

        {/* ---- STEP 1: Pair ---- */}
        {step === 1 && (
          <div>
            <p>
              Druk op de <strong>actieknop onderaan de hub</strong> en klik dan op "Koppel". De app wacht automatisch op bevestiging.
            </p>
            {!token && (
              <button
                style={styles.btn('primary')}
                onClick={handlePair}
                disabled={loading || pairingStarted}
              >
                {loading ? (pairingStatus === 'waiting' ? 'Wachten op knop...' : 'Bezig...') : 'Koppel hub'}
              </button>
            )}
            {pairingStarted && pairingStatus === 'waiting' && (
              <div style={{ ...styles.info, marginTop: 12 }}>
                Wachten op koppeling... Druk de knop op de onderkant van de hub in.
              </div>
            )}
            {token && (
              <div style={styles.success}>
                Koppeling succesvol! Token ontvangen.
              </div>
            )}
          </div>
        )}

        {/* ---- STEP 2: Address ---- */}
        {step === 2 && (
          <div>
            <label style={styles.label}>Postcode</label>
            <input
              style={styles.input}
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value.toUpperCase())}
              placeholder="1234AB"
              maxLength={7}
            />
            <label style={styles.label}>Huisnummer</label>
            <input
              style={styles.input}
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value)}
              placeholder="10"
            />
          </div>
        )}

        {/* ---- STEP 3: Light ---- */}
        {step === 3 && (
          <div>
            {loading && <div style={styles.info}>Lampen ophalen...</div>}
            {lights.length === 0 && !loading && (
              <div style={styles.error}>Geen lampen gevonden. Controleer de hub.</div>
            )}
            {lights.length > 0 && (
              <>
                <label style={styles.label}>Kies een lamp</label>
                <select
                  style={styles.select}
                  value={selectedLightId}
                  onChange={(e) => setSelectedLightId(e.target.value)}
                >
                  {lights.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.room ? `${l.room} — ` : ''}{l.name}
                    </option>
                  ))}
                </select>

                <label style={{ ...styles.label, marginTop: 8 }}>Meldingsmodus</label>
                {[
                  { value: 'rgb', label: 'RGB kleur', desc: 'Oranje (PMD), blauw (Papier), groen (GFT)' },
                  { value: 'colortemp', label: 'Warm/koel wit', desc: 'Warmst (PMD), koel (Papier), midden (GFT)' },
                  { value: 'onoff', label: 'Aan/uit', desc: 'Lamp gaat gewoon aan' },
                ].map((opt) => (
                  <label key={opt.value} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10,
                    padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                    border: `1.5px solid ${notificationMode === opt.value ? '#3498db' : '#ddd'}`,
                    background: notificationMode === opt.value ? '#eaf4fb' : '#fff',
                  }}>
                    <input
                      type="radio"
                      name="notificationMode"
                      value={opt.value}
                      checked={notificationMode === opt.value}
                      onChange={() => setNotificationMode(opt.value)}
                      style={{ marginTop: 2, accentColor: '#3498db' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{opt.label}</div>
                      <div style={{ fontSize: 13, color: '#777' }}>{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </>
            )}
          </div>
        )}

        {/* ---- STEP 4: Test & Save ---- */}
        {step === 4 && (
          <div>
            <p>Test de lamp met een afvaltype en sla dan de configuratie op.</p>
            <label style={styles.label}>Test afvaltype</label>
            <select style={styles.select} value={testType} onChange={(e) => setTestType(e.target.value)}>
              <option value="pmd">PMD afval (oranje)</option>
              <option value="papier">Papier afval (blauw)</option>
              <option value="gft">GFT afval (groen)</option>
            </select>
            <button style={styles.btn('primary')} onClick={handleTest} disabled={loading}>
              {loading ? 'Testen...' : 'Test lamp'}
            </button>
            {testResult && (
              <div style={styles.success}>
                Lamp brandt: <strong>{testResult.color}</strong> voor <strong>{testResult.wasteType}</strong>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <div>
            {step > 0 && (
              <button style={styles.btn('secondary')} onClick={() => { setStep(step - 1); clearMessages(); }}>
                Vorige
              </button>
            )}
          </div>
          <div>
            {step < STEPS.length - 1 && (
              <button
                style={styles.btn('primary')}
                onClick={() => { setStep(step + 1); clearMessages(); }}
                disabled={!canAdvance() || loading}
              >
                Volgende
              </button>
            )}
            {step === STEPS.length - 1 && (
              <button style={styles.btn('success')} onClick={handleSave} disabled={loading}>
                {loading ? 'Opslaan...' : 'Opslaan en afronden'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

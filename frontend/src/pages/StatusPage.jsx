import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from '../components/Calendar.jsx';
import TrashList from '../components/TrashList.jsx';

const TYPE_COLORS = {
  pmd: '#e67e22',
  papier: '#2980b9',
  gft: '#27ae60',
  rest: '#7f8c8d',
  other: '#95a5a6',
};

const LABELS = { pmd: 'PMD afval', papier: 'Papier afval', gft: 'GFT afval', rest: 'Restafval', other: 'Overig afval' };

const s = {
  page: { minHeight: '100vh', background: '#f0f4f8', padding: '24px 16px' },
  header: {
    maxWidth: 900, margin: '0 auto 20px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
  },
  title: { fontSize: 22, fontWeight: 800, color: '#2c3e50' },
  addressBadge: {
    background: '#fff', borderRadius: 8, padding: '6px 14px',
    fontSize: 14, color: '#555', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  main: {
    maxWidth: 900, margin: '0 auto',
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
  },
  notifBanner: (color) => ({
    maxWidth: 900, margin: '0 auto 16px', background: color, color: '#fff',
    borderRadius: 10, padding: '14px 20px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontWeight: 600, boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  }),
  dismissBtn: {
    background: 'rgba(255,255,255,0.25)', border: '1.5px solid rgba(255,255,255,0.6)',
    color: '#fff', borderRadius: 7, padding: '7px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 14,
  },
  panel: {
    maxWidth: 900, margin: '20px auto 0', background: '#fff',
    borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.08)', overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 20px', cursor: 'pointer', userSelect: 'none',
    borderBottom: '1px solid #f0f0f0',
  },
  panelTitle: { fontWeight: 700, fontSize: 15, color: '#2c3e50' },
  panelBody: { padding: '20px' },
  row: { display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 160 },
  label: { fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  select: {
    padding: '9px 12px', borderRadius: 8, border: '1.5px solid #ddd',
    fontSize: 14, color: '#333', background: '#fff', cursor: 'pointer', minWidth: 180,
  },
  btn: (variant) => ({
    padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap',
    background: variant === 'primary' ? '#3498db' : variant === 'success' ? '#27ae60' : '#eee',
    color: variant === 'primary' || variant === 'success' ? '#fff' : '#444',
  }),
  testRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 },
  testBtn: (color) => ({
    padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontWeight: 600, fontSize: 13, background: color, color: '#fff',
  }),
  footer: {
    maxWidth: 900, margin: '20px auto 0',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
  },
  footerBtn: (variant) => ({
    padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontWeight: 600, fontSize: 14,
    background: variant === 'danger' ? '#e74c3c' : '#eee',
    color: variant === 'danger' ? '#fff' : '#444',
  }),
  legend: { display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#555' },
  legendDot: (color) => ({ width: 12, height: 12, borderRadius: '50%', background: color }),
  error: {
    maxWidth: 900, margin: '0 auto 16px', background: '#fdecea',
    color: '#c0392b', borderRadius: 8, padding: '10px 16px', fontSize: 14,
  },
  successMsg: { fontSize: 13, color: '#27ae60', fontWeight: 600, marginTop: 8 },
};

export default function StatusPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [error, setError] = useState(null);
  const [dismissLoading, setDismissLoading] = useState(false);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  // Light settings panel
  const [lightPanelOpen, setLightPanelOpen] = useState(false);
  const [lights, setLights] = useState([]);
  const [lightsLoading, setLightsLoading] = useState(false);
  const [selectedLightId, setSelectedLightId] = useState('');
  const [notificationMode, setNotificationMode] = useState('rgb');
  const [saveMsg, setSaveMsg] = useState('');
  const [testMsg, setTestMsg] = useState('');
  const [testLoading, setTestLoading] = useState(null); // wasteType being tested

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Status ophalen mislukt');
      setStatus(data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const loadSchedule = useCallback(async () => {
    try {
      const res = await fetch('/api/schedule');
      if (res.ok) setSchedule(await res.json());
    } catch (e) { /* non-critical */ }
  }, []);

  useEffect(() => {
    loadStatus();
    loadSchedule();
    const interval = setInterval(loadStatus, 60000);
    return () => clearInterval(interval);
  }, [loadStatus, loadSchedule]);

  const loadLights = useCallback(async () => {
    setLightsLoading(true);
    try {
      const res = await fetch('/api/setup/lights');
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setLights(data);
      // Pre-select current light
      const config = await fetch('/api/config').then(r => r.json());
      if (config.lightId) setSelectedLightId(config.lightId);
      else if (data.length > 0) {
        const match = data.find(l => l.room === config.roomName && l.name === config.lightName);
        if (match) setSelectedLightId(match.id);
      }
      if (config.notificationMode) setNotificationMode(config.notificationMode);
    } catch (err) {
      setError('Lampen ophalen mislukt: ' + err.message);
    } finally {
      setLightsLoading(false);
    }
  }, []);

  const handlePanelToggle = () => {
    const next = !lightPanelOpen;
    setLightPanelOpen(next);
    if (next && lights.length === 0) loadLights();
  };

  const handleSaveLight = async () => {
    const light = lights.find(l => l.id === selectedLightId);
    if (!light) return;
    setSaveMsg('');
    try {
      const res = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: light.room, lightName: light.name, lightId: light.id, notificationMode }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSaveMsg('Opgeslagen!');
      await loadStatus();
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setError('Opslaan mislukt: ' + err.message);
    }
  };

  const handleTest = async (wasteType) => {
    setTestLoading(wasteType);
    setTestMsg('');
    try {
      const res = await fetch('/api/notify/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wasteType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTestMsg(`Lamp actief: ${data.notification.color}`);
      await loadStatus();
      setTimeout(() => setTestMsg(''), 5000);
    } catch (err) {
      setError('Test mislukt: ' + err.message);
    } finally {
      setTestLoading(null);
    }
  };

  const handleDismiss = async () => {
    setDismissLoading(true);
    try {
      await fetch('/api/notify/dismiss', { method: 'DELETE' });
      await loadStatus();
    } catch (err) {
      setError('Kan melding niet sluiten: ' + err.message);
    } finally {
      setDismissLoading(false);
    }
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  const activeNotif = status?.activeNotification;
  const notifColor = activeNotif ? (TYPE_COLORS[activeNotif.wasteType] || '#555') : null;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.title}>Afvalkalender</div>
        {status && (
          <div style={s.addressBadge}>
            {status.postalCode} {status.houseNumber}
            {status.lightName && ` · ${status.roomName} / ${status.lightName}`}
          </div>
        )}
      </div>

      {error && <div style={s.error}>{error}</div>}

      {/* Active notification banner */}
      {activeNotif && (
        <div style={s.notifBanner(notifColor)}>
          <span>
            Melding actief: <strong>{LABELS[activeNotif.wasteType] || activeNotif.wasteType}</strong>
            {activeNotif.testMode ? ' (test)' : ''}
            {' '}— Lamp brandt {activeNotif.color}
          </span>
          <button style={s.dismissBtn} onClick={handleDismiss} disabled={dismissLoading}>
            {dismissLoading ? 'Bezig...' : 'Verwijder melding'}
          </button>
        </div>
      )}

      {/* Main grid */}
      <div style={s.main}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#555' }}>‹</button>
            <span />
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#555' }}>›</button>
          </div>
          <Calendar year={viewYear} month={viewMonth} schedule={schedule} />
        </div>
        <div>
          <TrashList schedule={schedule} />
        </div>
      </div>

      {/* Light settings panel */}
      <div style={s.panel}>
        <div style={s.panelHeader} onClick={handlePanelToggle}>
          <span style={s.panelTitle}>Lamp instelling</span>
          <span style={{ color: '#aaa', fontSize: 18 }}>{lightPanelOpen ? '▲' : '▼'}</span>
        </div>
        {lightPanelOpen && (
          <div style={s.panelBody}>
            <div style={s.row}>
              <div style={s.field}>
                <span style={s.label}>Kies lamp</span>
                {lightsLoading ? (
                  <span style={{ fontSize: 14, color: '#888' }}>Lampen laden...</span>
                ) : (
                  <select
                    style={s.select}
                    value={selectedLightId}
                    onChange={e => setSelectedLightId(e.target.value)}
                  >
                    <option value="">— selecteer lamp —</option>
                    {lights.map(l => (
                      <option key={l.id} value={l.id}>{l.room} / {l.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <span style={s.label}>Meldingsmodus</span>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                {[
                  { value: 'rgb', label: 'RGB kleur', sub: 'Oranje / blauw / groen' },
                  { value: 'colortemp', label: 'Warm/koel wit', sub: 'Warmst / koel / midden' },
                  { value: 'onoff', label: 'Aan/uit', sub: 'Lamp gaat gewoon aan' },
                ].map(opt => (
                  <label key={opt.value} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 130,
                    padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                    border: `1.5px solid ${notificationMode === opt.value ? '#3498db' : '#ddd'}`,
                    background: notificationMode === opt.value ? '#eaf4fb' : '#fff',
                  }}>
                    <input
                      type="radio"
                      name="notificationModeSt"
                      value={opt.value}
                      checked={notificationMode === opt.value}
                      onChange={() => setNotificationMode(opt.value)}
                      style={{ marginTop: 2, accentColor: '#3498db' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{opt.sub}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <button
                style={s.btn('primary')}
                onClick={handleSaveLight}
                disabled={!selectedLightId}
              >
                Opslaan
              </button>
            </div>
            {saveMsg && <div style={s.successMsg}>{saveMsg}</div>}

            <div style={{ marginTop: 20 }}>
              <span style={s.label}>Test melding</span>
              <div style={s.testRow}>
                {['pmd', 'papier', 'gft'].map(type => (
                  <button
                    key={type}
                    style={s.testBtn(TYPE_COLORS[type])}
                    onClick={() => handleTest(type)}
                    disabled={testLoading !== null}
                  >
                    {testLoading === type ? 'Bezig...' : LABELS[type]}
                  </button>
                ))}
                {activeNotif && (
                  <button
                    style={{ ...s.btn('default'), background: '#e74c3c', color: '#fff' }}
                    onClick={handleDismiss}
                    disabled={dismissLoading}
                  >
                    Uitzetten
                  </button>
                )}
              </div>
              {testMsg && <div style={s.successMsg}>{testMsg}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={s.footer}>
        <div style={s.legend}>
          {['pmd', 'papier', 'gft', 'rest'].map(type => (
            <div key={type} style={s.legendItem}>
              <div style={s.legendDot(TYPE_COLORS[type])} />
              <span>{LABELS[type]}</span>
            </div>
          ))}
        </div>
        <button style={s.footerBtn('secondary')} onClick={() => navigate('/setup')}>
          Instellingen
        </button>
      </div>
    </div>
  );
}

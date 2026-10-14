import React from 'react';

const TYPE_CONFIG = {
  pmd: { color: '#e67e22', bg: '#fef5ec', label: 'PMD afval', emoji: '🟠' },
  papier: { color: '#2980b9', bg: '#eaf4fb', label: 'Papier afval', emoji: '🔵' },
  gft: { color: '#27ae60', bg: '#eafaf1', label: 'GFT afval', emoji: '🟢' },
  rest: { color: '#7f8c8d', bg: '#f4f6f7', label: 'Restafval', emoji: '⚫' },
  other: { color: '#95a5a6', bg: '#f8f9fa', label: 'Overig afval', emoji: '⚪' },
};

const MONTHS_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const DAYS_NL = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = DAYS_NL[date.getDay()];
  return `${dow} ${d} ${MONTHS_SHORT[m - 1]}`;
}

function daysUntil(dateStr) {
  const today = new Date();
  const target = new Date(dateStr);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

export default function TrashList({ schedule }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const upcoming = (schedule || [])
    .filter(e => e.date >= todayStr)
    .slice(0, 6);

  if (upcoming.length === 0) {
    return (
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', color: '#999' }}>
        Geen ophaaldata gevonden.
      </div>
    );
  }

  const styles = {
    wrapper: { background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
    title: { fontWeight: 700, fontSize: 16, marginBottom: 14 },
    item: (bg) => ({
      display: 'flex',
      alignItems: 'center',
      padding: '10px 12px',
      borderRadius: 8,
      background: bg,
      marginBottom: 8,
      gap: 12,
    }),
    badge: (color) => ({
      width: 14,
      height: 14,
      borderRadius: '50%',
      background: color,
      flexShrink: 0,
    }),
    dateText: { fontWeight: 600, minWidth: 90, fontSize: 14 },
    labelText: { flex: 1, fontSize: 14 },
    daysText: (days) => ({
      fontSize: 13,
      color: days === 0 ? '#c0392b' : days === 1 ? '#e67e22' : '#888',
      fontWeight: days <= 1 ? 700 : 400,
    }),
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.title}>Komende ophaaldata</div>
      {upcoming.map((entry, idx) => {
        const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG.other;
        const days = daysUntil(entry.date);
        let daysLabel = days === 0 ? 'Vandaag' : days === 1 ? 'Morgen' : `Over ${days} dagen`;
        if (days < 0) daysLabel = `${Math.abs(days)} dagen geleden`;

        return (
          <div key={idx} style={styles.item(cfg.bg)}>
            <div style={styles.badge(cfg.color)} />
            <div style={styles.dateText}>{formatDate(entry.date)}</div>
            <div style={styles.labelText}>{entry.label || cfg.label}</div>
            <div style={styles.daysText(days)}>{daysLabel}</div>
          </div>
        );
      })}
    </div>
  );
}

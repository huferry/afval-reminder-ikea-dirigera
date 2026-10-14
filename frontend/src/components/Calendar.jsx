import React from 'react';

const TYPE_COLORS = {
  pmd: '#e67e22',
  papier: '#2980b9',
  gft: '#27ae60',
  rest: '#7f8c8d',
  other: '#95a5a6',
};

const DAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const MONTHS = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December',
];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

// Hand-drawn circle SVG — slightly wobbly, like drawn with a marker
function HandCircle({ color }) {
  return (
    <svg
      viewBox="0 0 44 44"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22 6 C32 5, 40 11, 40 22 C40 33, 32 40, 21 40 C10 40, 4 33, 4 22 C4 11, 11 5, 22 6 Z"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        style={{ strokeDasharray: 'none' }}
      />
      <path
        d="M8 36 C12 39, 17 41, 24 40"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export default function Calendar({ year, month, schedule }) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = getFirstDayOfWeek(year, month);
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const typesByDate = {};
  if (schedule) {
    schedule.forEach((entry) => {
      if (!typesByDate[entry.date]) typesByDate[entry.date] = [];
      if (!typesByDate[entry.date].includes(entry.type)) {
        typesByDate[entry.date].push(entry.type);
      }
    });
  }

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 17, marginBottom: 14 }}>
        {MONTHS[month]} {year}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {DAYS.map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#999', paddingBottom: 6 }}>
            {d}
          </div>
        ))}
        {rows.map((row, ri) =>
          row.map((day, ci) => {
            if (!day) return <div key={`e-${ri}-${ci}`} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const types = typesByDate[dateStr] || [];
            const isToday = dateStr === todayStr;
            // If multiple waste types on same day, pick first for circle color
            const circleColor = types.length > 0 ? (TYPE_COLORS[types[0]] || '#ccc') : null;

            return (
              <div
                key={dateStr}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  aspectRatio: '1',
                  borderRadius: 6,
                  background: isToday ? '#eaf4fb' : 'transparent',
                }}
              >
                {circleColor && <HandCircle color={circleColor} />}
                <span style={{
                  position: 'relative',
                  zIndex: 1,
                  fontSize: 13,
                  fontWeight: isToday || types.length > 0 ? 700 : 400,
                  color: types.length > 0 ? '#1a1a1a' : isToday ? '#2980b9' : '#444',
                }}>
                  {day}
                </span>
                {/* Small dot indicators for extra types */}
                {types.length > 1 && (
                  <div style={{
                    position: 'absolute',
                    bottom: 2,
                    display: 'flex',
                    gap: 2,
                    justifyContent: 'center',
                  }}>
                    {types.slice(1).map((type, ti) => (
                      <span key={ti} style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: TYPE_COLORS[type] || '#ccc',
                        display: 'inline-block',
                      }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

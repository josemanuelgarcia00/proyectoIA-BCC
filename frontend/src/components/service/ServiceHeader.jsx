import React from 'react';

export default function ServiceHeader({ name, status, statusClass, style }) {
  return (
    <h2 style={{
      color: 'var(--ink)', fontSize: '17px', fontWeight: 600,
      display: 'flex', alignItems: 'center', gap: '10px',
      ...style,
    }}>
      <span className="mono">{name}</span>
      {status && <span className={`stamp ${statusClass}`}>{status}</span>}
    </h2>
  );
}

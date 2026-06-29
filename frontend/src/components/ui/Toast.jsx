import React from 'react';

export default function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      background: message.startsWith('❌') ? 'var(--rust)' : 'var(--ink)',
      color: 'white',
      padding: '13px 18px',
      borderRadius: '2px',
      boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
      fontWeight: 500,
      fontSize: '13.5px',
      zIndex: 1000,
    }}>
      {message}
    </div>
  );
}

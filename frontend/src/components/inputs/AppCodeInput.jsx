import React from 'react';
import { APP_CODES } from '../../domain/enums';

const FIELD_INPUT_STYLE = {
  width: '100%', padding: '4px 7px', fontSize: '13px',
  borderRadius: '2px', fontFamily: 'inherit', boxSizing: 'border-box',
};

export default function AppCodeInput({ value, onChange, onBlur, className }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState(value ?? '');
  const containerRef = React.useRef(null);

  React.useEffect(() => { setQuery(value ?? ''); }, [value]);

  React.useEffect(() => {
    const close = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const filtered = query ? APP_CODES.filter((c) => c.startsWith(query)) : APP_CODES;
  const select = (code) => { setQuery(code); onChange(code); setOpen(false); };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
          setQuery(v);
          onChange(v);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setTimeout(() => setOpen(false), 150); if (onBlur) onBlur(); }}
        maxLength={3}
        placeholder="Código (3 letras, ej: ACG)"
        className={className}
        style={{ ...FIELD_INPUT_STYLE, letterSpacing: '2px' }}
      />
      {open && filtered.length > 0 && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'white', border: '1px solid var(--rule)', borderTop: 'none',
          borderRadius: '0 0 2px 2px', margin: 0, padding: 0, listStyle: 'none',
          maxHeight: '142px', overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
        }}>
          {filtered.map((code) => (
            <li
              key={code}
              onMouseDown={() => select(code)}
              style={{
                padding: '6px 10px', fontSize: '13px', cursor: 'pointer',
                fontFamily: 'monospace', letterSpacing: '1px',
                borderBottom: '1px solid var(--rule)',
                color: code === value ? 'var(--primary-dark, #1a6b3c)' : 'var(--ink)',
                background: code === value ? 'var(--primary-faint, #f0f8f4)' : 'white',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary-faint, #f0f8f4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = code === value ? 'var(--primary-faint, #f0f8f4)' : 'white'; }}
            >
              {code}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

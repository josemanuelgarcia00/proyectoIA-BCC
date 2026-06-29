import React from 'react';

const FIELD_INPUT_STYLE = {
  width: '100%', padding: '4px 7px', fontSize: '13px',
  borderRadius: '2px', fontFamily: 'inherit', boxSizing: 'border-box',
};

export default function FixedSelect({ value, onChange, onBlur, options, className }) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef(null);
  const normalize = (opt) => typeof opt === 'string' ? { value: opt, label: opt } : opt;
  const opts = options.map(normalize);
  const selected = opts.find((o) => o.value === value);
  const isError = className === 'input-error';

  React.useEffect(() => {
    const close = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const select = (val) => { onChange(val); setOpen(false); };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => { setTimeout(() => setOpen(false), 150); if (onBlur) onBlur(); }}
        style={{
          ...FIELD_INPUT_STYLE,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          textAlign: 'left', background: 'white', cursor: 'pointer', fontWeight: 'normal',
          border: `1px solid ${isError ? 'var(--rust, #c0392b)' : 'var(--rule)'}`,
          color: selected ? 'var(--ink)' : 'var(--text-muted)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : '— Seleccionar —'}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '6px' }}>▼</span>
      </button>
      {open && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'white', border: '1px solid var(--rule)', borderTop: 'none',
          borderRadius: '0 0 2px 2px', margin: 0, padding: 0, listStyle: 'none',
          maxHeight: '142px', overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
        }}>
          {opts.map((o) => (
            <li
              key={o.value}
              onMouseDown={() => select(o.value)}
              style={{
                padding: '6px 10px', fontSize: '13px', cursor: 'pointer',
                borderBottom: '1px solid var(--rule)',
                color: o.value === value ? 'var(--primary-dark, #1a6b3c)' : 'var(--ink)',
                background: o.value === value ? 'var(--primary-faint, #f0f8f4)' : 'white',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary-faint, #f0f8f4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = o.value === value ? 'var(--primary-faint, #f0f8f4)' : 'white'; }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

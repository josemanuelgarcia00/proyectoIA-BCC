import React, { useState } from 'react';

export default function ListEditor({ items, onChange, label, error, onBlur, submitted }) {
  const list = Array.isArray(items) ? items : [];
  const [touched, setTouched] = useState(new Set());

  const emptyIndices = new Set(
    list.map((item, i) => (!item || !item.trim() ? i : -1)).filter((i) => i >= 0)
  );
  const lowerValues = list.map((s) => (s || '').trim().toLowerCase());
  const dupeValues = new Set();
  const seenValues = new Set();
  for (const val of lowerValues) {
    if (val && seenValues.has(val)) dupeValues.add(val);
    if (val) seenValues.add(val);
  }
  const dupeIndices = new Set(
    lowerValues.map((v, i) => (v && dupeValues.has(v) ? i : -1)).filter((i) => i >= 0)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      {label ? (
        <span className="data-field-label" style={{ margin: 0, marginBottom: '4px' }}>{label}</span>
      ) : null}
      {list.length === 0 && (
        <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>N/D</span>
      )}
      <div className="list-editor-items">
        {list.map((item, idx) => {
          const hasItemError = (emptyIndices.has(idx) || dupeIndices.has(idx)) && (touched.has(idx) || submitted);
          return (
            <div key={idx} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input
                type="text"
                value={item}
                onChange={(e) => {
                  setTouched(prev => new Set([...prev, idx]));
                  const next = [...list];
                  next[idx] = e.target.value;
                  onChange(next);
                }}
                onBlur={onBlur}
                className={hasItemError ? 'input-error' : ''}
                style={{ flex: 1, minWidth: 0, padding: '4px 7px', fontSize: '13px', borderRadius: '2px', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={() => {
                  setTouched(prev => {
                    const next = new Set();
                    for (const i of prev) {
                      if (i < idx) next.add(i);
                      else if (i > idx) next.add(i - 1);
                    }
                    return next;
                  });
                  onChange(list.filter((_, i) => i !== idx));
                }}
                title="Eliminar"
                style={{ flex: 'none', padding: '4px 10px', fontSize: '12px', lineHeight: 1.4, cursor: 'pointer', border: '1px solid var(--rule)', borderRadius: '2px', background: 'white', color: 'var(--rust)', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}
              >Eliminar</button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onChange([...list, ''])}
        style={{ alignSelf: 'flex-start', marginTop: '4px', padding: '3px 10px', fontSize: '12px', cursor: 'pointer', border: '1px dashed var(--primary-dark)', borderRadius: '2px', background: 'transparent', color: 'var(--primary-dark)', fontWeight: 600, lineHeight: 1.5 }}
      >+ Añadir</button>
      {error && (
        <span className={error.startsWith('__warning__') ? 'field-warning-msg' : 'field-error-msg'}>
          {error.replace('__warning__', '')}
        </span>
      )}
    </div>
  );
}

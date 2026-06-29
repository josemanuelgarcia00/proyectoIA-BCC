import React from 'react';

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  onConfirm,
  onCancel,
  withObservations = false,
}) {
  const [observations, setObservations] = React.useState('');

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(21,48,47,0.55)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 2100, padding: '20px',
    }}>
      <div style={{
        background: 'white', borderRadius: '4px', padding: '24px',
        maxWidth: '440px', width: '100%', border: '1px solid var(--rule)',
      }}>
        <h3 style={{ color: 'var(--ink)', marginBottom: '10px', fontSize: '15px', fontWeight: 600 }}>
          {title}
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: withObservations ? '0' : '20px' }}>
          {message}
        </p>
        {withObservations && (
          <div style={{ marginTop: '16px', marginBottom: '20px' }}>
            <label style={{
              display: 'block', fontSize: '12px', color: 'var(--text-muted)',
              marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              Observaciones (opcional)
            </label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Motivo del rechazo u otras notas..."
              rows={3}
              style={{
                width: '100%', padding: '8px', borderRadius: '2px',
                border: '1px solid var(--rule)', fontSize: '13px',
                fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>
        )}
        <div className="buttons">
          <button className="btn-quiet" style={{ flex: 'none' }} onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn-reject" onClick={() => onConfirm(withObservations ? observations : undefined)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

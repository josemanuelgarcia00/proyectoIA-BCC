import React from 'react';

const STATUS_STAMP = {
  'Aceptado': 'stamp-moss',
  'Unificado': 'stamp-moss',
  'Cerrado': 'stamp-moss',
  'Desechado': 'stamp-rust',
  'En revision': 'stamp-amber'
};

const LIST_FIELDS = [
  { key: 'inputs',           label: 'Entradas' },
  { key: 'outputs',          label: 'Salidas' },
  { key: 'invokes',          label: 'Invoca' },
  { key: 'reference_tables', label: 'Tablas referenciales' },
];

export default function DictionaryEntry({ service }) {
  if (!service) {
    return <div className="empty">Selecciona un servicio para ver sus datos.</div>;
  }

  const data = service.dictionary_data;
  const stampClass = STATUS_STAMP[service.status] || 'stamp-ink';

  return (
    <div className="iteration-review">
      <h2 style={{ marginBottom: '16px', color: 'var(--ink)', fontSize: '17px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className="mono">{service.service_name}</span>
        <span className={`stamp ${stampClass}`}>{service.status}</span>
      </h2>

      {service.observations && (
        <div className="info-line" style={{ background: 'var(--paper)', borderLeftColor: 'var(--rule-strong)', marginBottom: '20px' }}>
          <div>
            <strong style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.6px' }}>
              Observaciones
            </strong>
            {service.observations}
          </div>
        </div>
      )}

      {!data ? (
        <div className="empty" style={{ border: '1px solid var(--rule)', borderRadius: '3px', background: 'white' }}>
          No hay datos del Diccionario para este servicio.
        </div>
      ) : (
        <div className="data-card accent-primary">
          <h3>Diccionario maestro</h3>

          <div className="data-grid">
            <div><span className="data-field-label">App</span><span className="mono">{data.app || 'N/D'}</span></div>
            <div><span className="data-field-label">Tipo</span><span className="mono">{data.type || 'N/D'}</span></div>
            <div><span className="data-field-label">Verbo</span><span className="mono">{data.verb || 'N/D'}</span></div>
            <div><span className="data-field-label">Ámbito</span>{data.scope || 'N/D'}</div>
            <div><span className="data-field-label">Fiabilidad</span>{data.reliability || 'N/D'}</div>
            <div className="wide"><span className="data-field-label">Documento</span>{data.source_document || 'N/D'} <span className="mono">v{data.doc_version || '-'}</span></div>

            <div className="data-field-block">
              <span className="data-field-label">Uso funcional</span>
              {data.functional_use || 'N/D'}
            </div>

            <div className="list-fields-block">
              {LIST_FIELDS.map(({ key, label }) => (
                <div key={key} className="list-field">
                  <span className="data-field-label">{label}</span>
                  <div className="list-pills">
                    {data[key]?.length > 0
                      ? data[key].map((v, i) => <span key={i} className="data-pill">{v}</span>)
                      : <span className="pill-empty">N/D</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
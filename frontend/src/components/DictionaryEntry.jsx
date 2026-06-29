import React from 'react';
import DataCard from './ui/DataCard';
import ListFieldsDisplay from './service/ListFieldsDisplay';
import ServiceHeader from './service/ServiceHeader';

const STATUS_STAMP = {
  'Aceptado': 'stamp-moss',
  'Unificado': 'stamp-moss',
  'Cerrado': 'stamp-moss',
  'Desechado': 'stamp-rust',
  'En revision': 'stamp-amber',
};

export default function DictionaryEntry({ service }) {
  if (!service) {
    return <div className="empty">Selecciona un servicio para ver sus datos.</div>;
  }

  const data = service.dictionary_data;
  const stampClass = STATUS_STAMP[service.status] || 'stamp-ink';

  return (
    <div className="iteration-review">
      <ServiceHeader
        name={service.service_name}
        status={service.status}
        statusClass={stampClass}
        style={{ marginBottom: '16px' }}
      />

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
        <DataCard title="Diccionario maestro" accent="primary">
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
            <ListFieldsDisplay data={data} />
          </div>
        </DataCard>
      )}
    </div>
  );
}

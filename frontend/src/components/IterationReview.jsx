import React from 'react';

export default function IterationReview({ service }) {
  if (!service || !service.perimeter_iterations) {
    return <div className="empty">Cargando detalles del servicio...</div>;
  }

  // Función auxiliar para renderizar listas de forma segura
  const renderList = (list) => {
    if (!list || list.length === 0) return 'N/A';
    return list.join(', ');
  };

  return (
    <div className="iteration-review">
      <h2 style={{ marginBottom: '16px', color: 'var(--primary-dark)', fontSize: '18px', fontWeight: 'bold' }}>
        Revisando: {service.service_name}
      </h2>

      {/* =========================================
          CAJA DEL DICCIONARIO MAESTRO
      ========================================= */}
      {!service.is_in_dictionary ? (
        <div style={{ 
            background: '#fff3cd', border: '2px dashed #ffeeba', color: '#856404', 
            padding: '24px', borderRadius: '6px', textAlign: 'center', 
            marginBottom: '24px', fontSize: '15px', fontWeight: 'bold' 
        }}>
          🚨 Este servicio NO existe en el Diccionario Maestro.<br/>
          <span style={{fontWeight: 'normal', fontSize: '13px', marginTop: '8px', display: 'block'}}>
            Es un servicio de nueva creación detectado en el perímetro.
          </span>
        </div>
      ) : (
        <div style={{ 
            background: 'white', border: '1px solid var(--primary)', borderTop: '4px solid var(--primary-dark)',
            padding: '20px', borderRadius: '6px', marginBottom: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          <h3 style={{ color: 'var(--primary-dark)', marginBottom: '20px', fontSize: '14px', textTransform: 'uppercase', fontWeight: '700' }}>
            📚 Datos del Diccionario (Maestro)
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', fontSize: '13px' }}>
            <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>App:</strong> {service.dictionary_data?.app || 'N/A'}</div>
            <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Tipo:</strong> {service.dictionary_data?.type || 'N/A'}</div>
            <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Verbo:</strong> {service.dictionary_data?.verb || 'N/A'}</div>
            <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Ámbito:</strong> {service.dictionary_data?.scope || 'N/A'}</div>
            <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Fiabilidad:</strong> {service.dictionary_data?.reliability || 'N/A'}</div>
            <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Documento:</strong> {service.dictionary_data?.source_document || 'N/A'} (v{service.dictionary_data?.doc_version || '-'})</div>
            
            <div style={{ gridColumn: '1 / -1', background: '#f8f9fa', padding: '12px', borderRadius: '4px', marginTop: '8px', border: '1px solid var(--border)' }}>
                <strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px'}}>Uso Funcional:</strong> 
                {service.dictionary_data?.functional_use || 'N/A'}
            </div>

            <div style={{ gridColumn: '1 / -1' }}><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Entradas:</strong> {renderList(service.dictionary_data?.inputs)}</div>
            <div style={{ gridColumn: '1 / -1' }}><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Salidas:</strong> {renderList(service.dictionary_data?.outputs)}</div>
            <div style={{ gridColumn: '1 / -1' }}><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Invoca:</strong> {renderList(service.dictionary_data?.invokes)}</div>
            <div style={{ gridColumn: '1 / -1' }}><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Tablas Referenciales:</strong> {renderList(service.dictionary_data?.reference_tables)}</div>
          </div>
        </div>
      )}
      
      {/* =========================================
          ITERACIONES Y CONFLICTOS
      ========================================= */}
      {service.perimeter_iterations.length === 0 ? (
        <div className="empty" style={{border: '1px solid var(--border)', borderRadius: '6px', background: 'white'}}>
          No hay iteraciones registradas para este servicio.
        </div>
      ) : (
        service.perimeter_iterations.map((iteration, index) => (
          <div key={iteration.iteration_id} className="field-diff">
            
            <div className="iteration-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🔄 Iteración {index + 1} de {service.perimeter_iterations.length}</span>
              <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-muted)' }}>ID: {iteration.iteration_id}</span>
            </div>

            {/* Datos detallados de la iteración actual */}
            <div style={{ marginBottom: '24px', padding: '16px', background: 'white', borderRadius: '4px', border: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: '12px', color: 'var(--primary-dark)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                📄 Datos Capturados del Perímetro
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', fontSize: '13px' }}>
                <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>App:</strong> {iteration.data.app || 'N/A'}</div>
                <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Tipo:</strong> {iteration.data.type || 'N/A'}</div>
                <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Verbo:</strong> {iteration.data.verb || 'N/A'}</div>
                <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Ámbito:</strong> {iteration.data.scope || 'N/A'}</div>
                <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Fiabilidad:</strong> {iteration.data.reliability || 'N/A'}</div>
                <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Documento:</strong> {iteration.data.source_document || 'N/A'} (v{iteration.data.doc_version || '-'})</div>

                <div style={{ gridColumn: '1 / -1', background: '#f8f9fa', padding: '12px', borderRadius: '4px', marginTop: '4px', border: '1px solid var(--border)' }}>
                    <strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px'}}>Uso Funcional:</strong> 
                    {iteration.data.functional_use || 'N/A'}
                </div>

                <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Entradas:</strong> {renderList(iteration.data.inputs)}</div>
                <div style={{ gridColumn: '1 / -1' }}><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Salidas:</strong> {renderList(iteration.data.outputs)}</div>
                <div style={{ gridColumn: '1 / -1' }}><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Invoca:</strong> {renderList(iteration.data.invokes)}</div>
                <div style={{ gridColumn: '1 / -1' }}><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Tablas Referenciales:</strong> {renderList(iteration.data.reference_tables)}</div>
              </div>
            </div>

            {/* Mapeo de Conflictos */}
            {(!iteration.conflicts || iteration.conflicts.length === 0) ? (
              <div style={{ textAlign: 'center', color: 'var(--success)', background: '#e8f5e9', padding: '16px', borderRadius: '4px', border: '1px solid #c8e6c9' }}>
                ✨ Sin conflictos con el diccionario en esta iteración
              </div>
            ) : (
              <div style={{ background: '#fff9f0', padding: '16px', borderRadius: '4px', border: '1px solid #ffe0b2' }}>
                <h4 style={{ fontSize: '13px', color: 'var(--warning)', marginBottom: '16px', textTransform: 'uppercase', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚠️ Conflictos Detectados ({iteration.conflicts.length})
                </h4>
                
                {iteration.conflicts.map((conflict, idx) => (
                  <div key={idx} style={{ marginBottom: '16px', borderLeft: '3px solid var(--warning)', paddingLeft: '16px', background: 'white', padding: '12px', borderRadius: '0 4px 4px 0', border: '1px solid var(--border)', borderLeftColor: 'var(--warning)' }}>
                    <div className="field-name" style={{color: 'var(--primary-dark)'}}>Columna: {conflict.column}</div>
                    <div className="field-values">
                      <div className="value-box">
                        <div className="label">Diccionario (Maestro)</div>
                        <div style={{ color: 'var(--error)', textDecoration: 'line-through' }}>
                          {conflict.original || 'N/D'}
                        </div>
                      </div>
                      <div className="value-box">
                        <div className="label">Nueva Propuesta</div>
                        <div style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                          {conflict.proposed || 'N/D'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                <div className="buttons">
                  <button className="btn-accept">Aceptar Propuesta</button>
                  <button className="btn-reject">Mantener Diccionario</button>
                </div>
              </div>
            )}
            
          </div>
        ))
      )}
    </div>
  );
}
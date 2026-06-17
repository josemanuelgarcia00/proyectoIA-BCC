import React from 'react';

export default function IterationReview({ service }) {
  // Protección por si el servicio aún no ha cargado correctamente
  if (!service || !service.perimeter_iterations) {
    return <div className="empty">Cargando detalles del servicio...</div>;
  }

  return (
    <div className="iteration-review">
      <h2 style={{ marginBottom: '16px', color: 'var(--primary-dark)' }}>
        Revisando: {service.service_name}
      </h2>
      
      {service.perimeter_iterations.length === 0 ? (
        <div className="empty">No hay iteraciones registradas para este servicio.</div>
      ) : (
        service.perimeter_iterations.map((iteration) => (
          <div key={iteration.iteration_id} className="field-diff" style={{ marginBottom: '24px' }}>
            
            <div className="iteration-header" style={{ marginBottom: '16px' }}>
              🔄 Iteración {iteration.iteration_id} de {service.perimeter_iterations.length}
            </div>
            
            {/* Resumen de los datos de la iteración (Leemos de iteration.data) */}
            <div style={{ marginBottom: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
              <h4 style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Datos capturados del Perímetro
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                <div><strong>App:</strong> {iteration.data.app || 'N/A'}</div>
                <div><strong>Verbo:</strong> {iteration.data.verb || 'N/A'}</div>
                <div><strong>Tipo:</strong> {iteration.data.type || 'N/A'}</div>
                <div><strong>Ámbito:</strong> {iteration.data.scope || 'N/A'}</div>
              </div>
            </div>

            {/* Mapeo de Conflictos */}
            {(!iteration.conflicts || iteration.conflicts.length === 0) ? (
              <div style={{ textAlign: 'center', color: '#888', fontStyle: 'italic', padding: '12px' }}>
                ✨ Sin conflictos con el diccionario en esta iteración
              </div>
            ) : (
              <div>
                <h4 style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '12px', textTransform: 'uppercase' }}>
                  ⚠️ Conflictos Detectados ({iteration.conflicts.length})
                </h4>
                
                {iteration.conflicts.map((conflict, idx) => (
                  <div key={idx} style={{ marginBottom: '16px', borderLeft: '3px solid var(--warning)', paddingLeft: '12px' }}>
                    <div className="field-name">Columna: {conflict.column}</div>
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
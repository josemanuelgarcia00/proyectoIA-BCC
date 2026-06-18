import React from 'react';

export default function IterationReview({ service }) {
  if (!service || !service.perimeter_iterations) {
    return <div className="empty">Cargando detalles del servicio...</div>;
  }

  return (
    <div className="iteration-review">
      <h2 style={{ marginBottom: '16px', color: 'var(--primary-dark)' }}>
        Revisando: {service.service_name}
      </h2>

      {/* --- CAJA DEL DICCIONARIO MAESTRO --- */}
      {!service.is_in_dictionary ? (
        <div style={{ 
            background: '#fff3cd', border: '2px dashed #ffeeba', color: '#856404', 
            padding: '24px', borderRadius: '8px', textAlign: 'center', 
            marginBottom: '24px', fontSize: '15px', fontWeight: 'bold' 
        }}>
          🚨 Este servicio NO existe en el Diccionario Maestro.<br/>
          <span style={{fontWeight: 'normal', fontSize: '13px', marginTop: '8px', display: 'block'}}>
            Es un servicio de nueva creación detectado en el perímetro.
          </span>
        </div>
      ) : (
        <div style={{ 
            background: 'white', border: '1px solid #c8e6c9', borderTop: '4px solid #4caf50',
            padding: '16px', borderRadius: '8px', marginBottom: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          <h3 style={{ color: '#2e7d32', marginBottom: '16px', fontSize: '14px', textTransform: 'uppercase', fontWeight: '700' }}>
            📚 Datos del Diccionario (Maestro)
          </h3>
          
          {/* Usamos Flexbox para que se adapte perfectamente al ancho */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px' }}>
            <div style={{ flex: '1 1 120px' }}>
              <strong style={{color: '#666', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>App:</strong> 
              {service.dictionary_data?.app || 'N/A'}
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <strong style={{color: '#666', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Tipo:</strong> 
              {service.dictionary_data?.type || 'N/A'}
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <strong style={{color: '#666', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Verbo:</strong> 
              {service.dictionary_data?.verb || 'N/A'}
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <strong style={{color: '#666', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Ámbito:</strong> 
              {service.dictionary_data?.scope || 'N/A'}
            </div>
            
            <div style={{ flex: '1 1 100%', background: '#f8f9fa', padding: '10px', borderRadius: '6px', marginTop: '4px' }}>
                <strong style={{color: '#666', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Uso Funcional:</strong> 
                {service.dictionary_data?.functional_use || 'N/A'}
            </div>
          </div>
        </div>
      )}
      
      {/* --- ITERACIONES Y CONFLICTOS --- */}
      {service.perimeter_iterations.length === 0 ? (
        <div className="empty">No hay iteraciones registradas para este servicio.</div>
      ) : (
        service.perimeter_iterations.map((iteration, index) => (
          <div key={iteration.iteration_id} className="field-diff" style={{ marginBottom: '24px' }}>
            
            <div className="iteration-header" style={{ marginBottom: '16px' }}>
              🔄 Iteración {index + 1} de {service.perimeter_iterations.length}
            </div>

            {/* Datos de la iteración actual */}
            <div style={{ marginBottom: '16px', padding: '12px', background: 'white', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: '11px', color: 'var(--text-light)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Datos Capturados del Perímetro
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div><strong>App:</strong> {iteration.data.app || 'N/A'}</div>
                <div><strong>Verbo:</strong> {iteration.data.verb || 'N/A'}</div>
                <div><strong>Tipo:</strong> {iteration.data.type || 'N/A'}</div>
                <div><strong>Ámbito:</strong> {iteration.data.scope || 'N/A'}</div>
              </div>
            </div>

            {/* Mapeo de Conflictos */}
            {(!iteration.conflicts || iteration.conflicts.length === 0) ? (
              <div style={{ textAlign: 'center', color: '#888', fontStyle: 'italic', padding: '16px' }}>
                ✨ Sin conflictos con el diccionario en esta iteración
              </div>
            ) : (
              <div>
                <h4 style={{ fontSize: '13px', color: 'var(--error)', margin: '20px 0 12px 0', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  ⚠️ Conflictos Detectados ({iteration.conflicts.length})
                </h4>
                
                {iteration.conflicts.map((conflict, idx) => (
                  <div key={idx} style={{ marginBottom: '16px', borderLeft: '3px solid var(--warning)', paddingLeft: '12px' }}>
                    <div className="field-name" style={{color: '#0066cc'}}>Columna: {conflict.column}</div>
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
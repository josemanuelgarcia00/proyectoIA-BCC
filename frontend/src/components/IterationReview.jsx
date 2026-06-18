import React, { useState, useEffect } from 'react';

export default function IterationReview({ service, onServiceClosed }) {
  const [localService, setLocalService] = useState(service);
  const [hiddenIterations, setHiddenIterations] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [previewData, setPreviewData] = useState(null);

  // Cuando se selecciona otro servicio en la lista, reiniciamos el estado local
  useEffect(() => {
    setLocalService(service);
    setHiddenIterations(new Set());
    setToast(null);
    setPreviewData(null);
  }, [service]);

  if (!localService || !localService.perimeter_iterations) {
    return <div className="empty">Cargando detalles del servicio...</div>;
  }

  // Función auxiliar para renderizar listas de forma segura
  const renderList = (list) => {
    if (!list || list.length === 0) return 'N/A';
    return list.join(', ');
  };

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 4000);
  };

  const resolveIteration = async (iterationId, resolution) => {
    setResolvingId(iterationId);
    try {
      const res = await fetch(
        `/api/v1/services/${encodeURIComponent(localService.service_name)}/iterations/${iterationId}/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolution })
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'No se pudo resolver la iteración');
      }

      const updated = await res.json();
      setLocalService(updated);
      setHiddenIterations(prev => new Set(prev).add(iterationId));
      showToast(`✅ Iteración ${iterationId} revisada`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setResolvingId(null);
    }
  };

  const revertIteration = async (iterationId) => {
    setResolvingId(iterationId);
    try {
      const res = await fetch(
        `/api/v1/services/${encodeURIComponent(localService.service_name)}/iterations/${iterationId}/revert`,
        { method: 'POST' }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'No se pudo volver atrás la iteración');
      }

      const updated = await res.json();
      setLocalService(updated);
      setHiddenIterations(prev => {
        const next = new Set(prev);
        next.delete(iterationId);
        return next;
      });
      showToast(`↩ Iteración ${iterationId} restaurada`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setResolvingId(null);
    }
  };

  const resetServiceConflicts = async () => {
    setResolvingId('reset');
    try {
      const res = await fetch(
        `/api/v1/services/${encodeURIComponent(localService.service_name)}/reset`,
        { method: 'POST' }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'No se pudo reiniciar el servicio');
      }

      const updated = await res.json();
      setLocalService(updated);
      setHiddenIterations(new Set());
      showToast(`↺ Conflictos de ${localService.service_name} reiniciados`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setResolvingId(null);
    }
  };

  const requestAcceptPreview = async () => {
    setResolvingId('accept-close');
    try {
      const res = await fetch(
        `/api/v1/services/${encodeURIComponent(localService.service_name)}/accept/preview`
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'No se pudo calcular el resultado final');
      }

      const preview = await res.json();
      setPreviewData(preview);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setResolvingId(null);
    }
  };

  const confirmAcceptAndClose = async () => {
    setResolvingId('accept-close');
    try {
      const res = await fetch(
        `/api/v1/services/${encodeURIComponent(localService.service_name)}/accept`,
        { method: 'POST' }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'No se pudo aceptar el servicio');
      }

      setPreviewData(null);
      showToast(`✅ ${localService.service_name} aceptado y cerrado`);
      if (onServiceClosed) onServiceClosed(localService.service_name);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setResolvingId(null);
    }
  };

  // Solo interesa mostrar iteraciones con conflictos pendientes de revisar
  const visibleIterations = localService.perimeter_iterations.filter(
    it => it.conflicts && it.conflicts.length > 0 && !hiddenIterations.has(it.iteration_id)
  );

  // Última iteración = dato consolidado que pasaría al Diccionario una vez revisado todo
  const finalData = localService.perimeter_iterations.length > 0
    ? localService.perimeter_iterations[localService.perimeter_iterations.length - 1].data
    : null;

  // Cuando ya no quedan conflictos pendientes, mostramos diccionario y resultado final lado a lado
  const allResolved = localService.perimeter_iterations.length > 0 && visibleIterations.length === 0;

  // Iteraciones ya revisadas (ocultas), para poder volver atrás una a una
  const resolvedIterations = localService.perimeter_iterations.filter(
    it => hiddenIterations.has(it.iteration_id)
  );

  const resolutionLabel = (resolution) => {
    if (resolution === 'unify') return 'Unificada';
    if (resolution === 'reject') return 'Cambios rechazados';
    return 'Revisada';
  };

  const dictionaryBox = !localService.is_in_dictionary ? (
    <div style={{
        background: '#fff3cd', border: '2px dashed #ffeeba', color: '#856404',
        padding: '24px', borderRadius: '6px', textAlign: 'center',
        fontSize: '15px', fontWeight: 'bold'
    }}>
      🚨 Este servicio NO existe en el Diccionario Maestro.<br/>
      <span style={{fontWeight: 'normal', fontSize: '13px', marginTop: '8px', display: 'block'}}>
        Es un servicio de nueva creación detectado en el perímetro.
      </span>
    </div>
  ) : (
    <div style={{
        background: 'white', border: '1px solid var(--primary)', borderTop: '4px solid var(--primary-dark)',
        padding: '20px', borderRadius: '6px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
    }}>
      <h3 style={{ color: 'var(--primary-dark)', marginBottom: '20px', fontSize: '14px', textTransform: 'uppercase', fontWeight: '700' }}>
        📚 Datos del Diccionario (Maestro)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', fontSize: '13px' }}>
        <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>App:</strong> {localService.dictionary_data?.app || 'N/A'}</div>
        <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Tipo:</strong> {localService.dictionary_data?.type || 'N/A'}</div>
        <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Verbo:</strong> {localService.dictionary_data?.verb || 'N/A'}</div>
        <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Ámbito:</strong> {localService.dictionary_data?.scope || 'N/A'}</div>
        <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Fiabilidad:</strong> {localService.dictionary_data?.reliability || 'N/A'}</div>
        <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Documento:</strong> {localService.dictionary_data?.source_document || 'N/A'} (v{localService.dictionary_data?.doc_version || '-'})</div>

        <div style={{ gridColumn: '1 / -1', background: '#f8f9fa', padding: '12px', borderRadius: '4px', marginTop: '8px', border: '1px solid var(--border)' }}>
            <strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px'}}>Uso Funcional:</strong>
            {localService.dictionary_data?.functional_use || 'N/A'}
        </div>

        <div style={{ gridColumn: '1 / -1' }}><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Entradas:</strong> {renderList(localService.dictionary_data?.inputs)}</div>
        <div style={{ gridColumn: '1 / -1' }}><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Salidas:</strong> {renderList(localService.dictionary_data?.outputs)}</div>
        <div style={{ gridColumn: '1 / -1' }}><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Invoca:</strong> {renderList(localService.dictionary_data?.invokes)}</div>
        <div style={{ gridColumn: '1 / -1' }}><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Tablas Referenciales:</strong> {renderList(localService.dictionary_data?.reference_tables)}</div>
      </div>
    </div>
  );

  const finalResultBox = (
    <div style={{
        background: 'white', border: '1px solid var(--success)', borderTop: '4px solid var(--success)',
        padding: '20px', borderRadius: '6px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
    }}>
      <h3 style={{ color: 'var(--success)', marginBottom: '20px', fontSize: '14px', textTransform: 'uppercase', fontWeight: '700' }}>
        ✅ Revisión Completada — Resultado para el Diccionario
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', fontSize: '13px' }}>
        <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>App:</strong> {finalData.app || 'N/A'}</div>
        <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Tipo:</strong> {finalData.type || 'N/A'}</div>
        <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Verbo:</strong> {finalData.verb || 'N/A'}</div>
        <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Ámbito:</strong> {finalData.scope || 'N/A'}</div>
        <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Fiabilidad:</strong> {finalData.reliability || 'N/A'}</div>
        <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Documento:</strong> {finalData.source_document || 'N/A'} (v{finalData.doc_version || '-'})</div>

        <div style={{ gridColumn: '1 / -1', background: '#f8f9fa', padding: '12px', borderRadius: '4px', marginTop: '8px', border: '1px solid var(--border)' }}>
            <strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px'}}>Uso Funcional:</strong>
            {finalData.functional_use || 'N/A'}
        </div>

        <div style={{ gridColumn: '1 / -1' }}><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Entradas:</strong> {renderList(finalData.inputs)}</div>
        <div style={{ gridColumn: '1 / -1' }}><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Salidas:</strong> {renderList(finalData.outputs)}</div>
        <div style={{ gridColumn: '1 / -1' }}><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Invoca:</strong> {renderList(finalData.invokes)}</div>
        <div style={{ gridColumn: '1 / -1' }}><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Tablas Referenciales:</strong> {renderList(finalData.reference_tables)}</div>
      </div>

      <div className="buttons" style={{ marginTop: '20px' }}>
        <button
          className="btn-accept"
          disabled={resolvingId === 'accept-close'}
          onClick={requestAcceptPreview}
        >
          {resolvingId === 'accept-close' ? 'Calculando...' : '✅ Aceptar Cambios'}
        </button>
        <button
          className="btn-reject"
          disabled={resolvingId === 'reset'}
          onClick={resetServiceConflicts}
        >
          {resolvingId === 'reset' ? 'Aplicando...' : '↺ Reiniciar Conflicto'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="iteration-review">
      <h2 style={{ marginBottom: '16px', color: 'var(--primary-dark)', fontSize: '18px', fontWeight: 'bold' }}>
        Revisando: {localService.service_name}
      </h2>

      {localService.perimeter_iterations.length === 0 ? (
        <>
          {dictionaryBox}
          <div className="empty" style={{border: '1px solid var(--border)', borderRadius: '6px', background: 'white', marginTop: '24px'}}>
            No hay iteraciones registradas para este servicio.
          </div>
        </>
      ) : allResolved ? (
        /* Diccionario y resultado final lado a lado, una vez revisados todos los conflictos */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {dictionaryBox}
          {finalResultBox}
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '24px' }}>{dictionaryBox}</div>
          {visibleIterations.map((iteration, index) => (
          <div key={iteration.iteration_id} className="field-diff">

            <div className="iteration-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🔄 Iteración {index + 1} de {visibleIterations.length}</span>
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
            <div style={{ background: '#fff9f0', padding: '16px', borderRadius: '4px', border: '1px solid #ffe0b2' }}>
                <h4 style={{ fontSize: '13px', color: 'var(--warning)', marginBottom: '16px', textTransform: 'uppercase', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚠️ Conflictos Detectados ({iteration.conflicts.length})
                </h4>

                {iteration.conflicts.map((conflict, idx) => (
                  <div key={idx} style={{ marginBottom: '16px', borderLeft: '3px solid var(--warning)', paddingLeft: '16px', background: 'white', padding: '12px', borderRadius: '0 4px 4px 0', border: '1px solid var(--border)', borderLeftColor: 'var(--warning)' }}>
                    <div className="field-name" style={{color: 'var(--primary-dark)'}}>Columna: {conflict.column === 'document' ? 'Documento (origen + versión)' : conflict.column}</div>
                    <div className="field-values">
                      <div className="value-box" style={{ background: '#f1f1f1' }}>
                        <div className="label">Valor Anterior</div>
                        <div style={{ color: 'var(--text)' }}>
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
                  <button
                    className="btn-unify"
                    disabled={resolvingId === iteration.iteration_id}
                    onClick={() => resolveIteration(iteration.iteration_id, 'unify')}
                  >
                    {resolvingId === iteration.iteration_id ? 'Aplicando...' : 'Unificar'}
                  </button>
                  <button
                    className="btn-reject"
                    disabled={resolvingId === iteration.iteration_id}
                    onClick={() => resolveIteration(iteration.iteration_id, 'reject')}
                  >
                    {resolvingId === iteration.iteration_id ? 'Aplicando...' : 'Rechazar Cambios'}
                  </button>
                </div>
              </div>

            </div>
          ))}
        </>
      )}

      {resolvedIterations.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h4 style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Iteraciones ya revisadas
          </h4>
          {resolvedIterations.map(it => (
            <div
              key={it.iteration_id}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', background: '#f8f9fa', border: '1px solid var(--border)',
                borderRadius: '6px', marginBottom: '8px', fontSize: '13px'
              }}
            >
              <span>✔️ Iteración {it.iteration_id} — {resolutionLabel(it.resolution)}</span>
              <button
                className="btn-header"
                style={{ flex: 'none', padding: '6px 12px', fontSize: '12px' }}
                disabled={resolvingId === it.iteration_id}
                onClick={() => revertIteration(it.iteration_id)}
              >
                {resolvingId === it.iteration_id ? 'Aplicando...' : '↩ Volver atrás'}
              </button>
            </div>
          ))}
        </div>
      )}

      {previewData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 2000, padding: '20px'
        }}>
          <div style={{
            background: 'white', borderRadius: '8px', padding: '24px',
            maxWidth: '640px', width: '100%', maxHeight: '85vh', overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ color: 'var(--primary-dark)', marginBottom: '8px', fontSize: '16px' }}>
              📋 Así quedará en el Diccionario
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
              Resultado final de la revisión de <strong>{localService.service_name}</strong> (ya incluye lo unificado con el Diccionario en cada iteración). Nada se elimina ni se sobrescribe.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', fontSize: '13px' }}>
              <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>App:</strong> {previewData.app || 'N/A'}</div>
              <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Tipo:</strong> {previewData.type || 'N/A'}</div>
              <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Verbo:</strong> {previewData.verb || 'N/A'}</div>
              <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Ámbito:</strong> {previewData.scope || 'N/A'}</div>
              <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Fiabilidad:</strong> {previewData.reliability || 'N/A'}</div>
              <div><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Documento:</strong> {previewData.source_document || 'N/A'} (v{previewData.doc_version || '-'})</div>

              <div style={{ gridColumn: '1 / -1', background: '#f8f9fa', padding: '12px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                <strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px'}}>Uso Funcional:</strong>
                {previewData.functional_use || 'N/A'}
              </div>

              <div style={{ gridColumn: '1 / -1' }}><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Entradas:</strong> {renderList(previewData.inputs)}</div>
              <div style={{ gridColumn: '1 / -1' }}><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Salidas:</strong> {renderList(previewData.outputs)}</div>
              <div style={{ gridColumn: '1 / -1' }}><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Invoca:</strong> {renderList(previewData.invokes)}</div>
              <div style={{ gridColumn: '1 / -1' }}><strong style={{color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase'}}>Tablas Referenciales:</strong> {renderList(previewData.reference_tables)}</div>
            </div>

            <div className="buttons" style={{ marginTop: '24px' }}>
              <button
                className="btn-accept"
                disabled={resolvingId === 'accept-close'}
                onClick={confirmAcceptAndClose}
              >
                {resolvingId === 'accept-close' ? 'Aplicando...' : '✅ Confirmar y Cerrar'}
              </button>
              <button
                className="btn-reject"
                disabled={resolvingId === 'accept-close'}
                onClick={() => setPreviewData(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: toast.startsWith('❌') ? 'var(--error)' : 'var(--primary-dark)',
          color: 'white',
          padding: '14px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          fontWeight: 600,
          fontSize: '14px',
          zIndex: 1000
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
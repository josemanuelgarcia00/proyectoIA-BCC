import React, { useState, useEffect } from 'react';

const STATUS_STAMP = {
  'Aceptado': 'stamp-moss',
  'Unificado': 'stamp-moss',
  'Cerrado': 'stamp-moss',
  'Desechado': 'stamp-rust',
  'En revision': 'stamp-amber'
};

export default function IterationReview({ service, onServiceClosed }) {
  const [localService, setLocalService] = useState(service);
  const [hiddenIterations, setHiddenIterations] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [observations, setObservations] = useState(service?.observations || '');
  const [savingObservations, setSavingObservations] = useState(false);
  const [iterationObservations, setIterationObservations] = useState('');
  const [savingIterationObservations, setSavingIterationObservations] = useState(false);

  // Cuando se selecciona otro servicio en la lista, reiniciamos el estado local
  useEffect(() => {
    setLocalService(service);
    setHiddenIterations(new Set());
    setToast(null);
    setPreviewData(null);
    setObservations(service?.observations || '');
  }, [service]);

  // Sincroniza el cuadro de observaciones con la iteración pendiente actual
  // (la primera con conflictos sin revisar): al pasar a la siguiente, se recarga.
  useEffect(() => {
    const pending = (localService?.perimeter_iterations || []).filter(
      it => it.conflicts && it.conflicts.length > 0 && !hiddenIterations.has(it.iteration_id)
    );
    setIterationObservations(pending[0]?.observations || '');
  }, [localService, hiddenIterations]);

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

  const rejectService = async () => {
    const confirmed = window.confirm(
      `¿Seguro que quieres rechazar "${localService.service_name}"? No se incorporará al Diccionario.`
    );
    if (!confirmed) return;

    setResolvingId('reject-service');
    try {
      const res = await fetch(
        `/api/v1/services/${encodeURIComponent(localService.service_name)}/reject`,
        { method: 'POST' }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'No se pudo rechazar el servicio');
      }

      showToast(`❌ ${localService.service_name} rechazado`);
      if (onServiceClosed) onServiceClosed(localService.service_name);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setResolvingId(null);
    }
  };

  const saveObservations = async () => {
    setSavingObservations(true);
    try {
      const res = await fetch(
        `/api/v1/services/${encodeURIComponent(localService.service_name)}/observations`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ observations })
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'No se pudieron guardar las observaciones');
      }

      const updated = await res.json();
      setLocalService(updated);
      showToast('📝 Observaciones guardadas');
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setSavingObservations(false);
    }
  };

  const saveIterationObservations = async (iterationId) => {
    setSavingIterationObservations(true);
    try {
      const res = await fetch(
        `/api/v1/services/${encodeURIComponent(localService.service_name)}/iterations/${iterationId}/observations`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ observations: iterationObservations })
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'No se pudieron guardar las observaciones');
      }

      const updated = await res.json();
      setLocalService(updated);
      showToast('📝 Observaciones de la iteración guardadas');
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setSavingIterationObservations(false);
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

  // Servicio nuevo: no existe en el Diccionario Maestro, solo se puede aceptar o rechazar
  const isNewService = !localService.is_in_dictionary;

  // Iteraciones ya revisadas (ocultas), para poder volver atrás una a una
  const resolvedIterations = localService.perimeter_iterations.filter(
    it => hiddenIterations.has(it.iteration_id)
  );

  // Solo se muestra una iteración con conflictos a la vez (la siguiente aparece
  // al resolver la actual), manteniendo siempre su iteration_id original.
  const currentIteration = visibleIterations[0] || null;
  const totalConflictIterations = visibleIterations.length + resolvedIterations.length;
  const currentPosition = resolvedIterations.length + 1;

  const resolutionStamp = (resolution) => {
    if (resolution === 'unify') return { label: 'Unificada', cls: 'stamp-moss' };
    if (resolution === 'reject') return { label: 'Rechazada', cls: 'stamp-rust' };
    return { label: 'Revisada', cls: 'stamp-ink' };
  };

  const statusStampClass = STATUS_STAMP[localService.status] || 'stamp-ink';

  // Solo se usa cuando el servicio SÍ existe en el Diccionario (si es nuevo, se
  // muestra en su lugar el aviso de una sola línea más abajo en el render)
  const dictionaryBox = (
    <div className="data-card accent-primary">
      <h3>Diccionario maestro</h3>

      <div className="data-grid">
        <div><span className="data-field-label">App</span><span className="mono">{localService.dictionary_data?.app || 'N/A'}</span></div>
        <div><span className="data-field-label">Tipo</span><span className="mono">{localService.dictionary_data?.type || 'N/A'}</span></div>
        <div><span className="data-field-label">Verbo</span><span className="mono">{localService.dictionary_data?.verb || 'N/A'}</span></div>
        <div><span className="data-field-label">Ámbito</span>{localService.dictionary_data?.scope || 'N/A'}</div>
        <div><span className="data-field-label">Fiabilidad</span>{localService.dictionary_data?.reliability || 'N/A'}</div>
        <div><span className="data-field-label">Documento</span>{localService.dictionary_data?.source_document || 'N/A'} <span className="mono">v{localService.dictionary_data?.doc_version || '-'}</span></div>

        <div className="data-field-block">
          <span className="data-field-label">Uso funcional</span>
          {localService.dictionary_data?.functional_use || 'N/A'}
        </div>

        <div className="wide"><span className="data-field-label">Entradas</span><span className="mono">{renderList(localService.dictionary_data?.inputs)}</span></div>
        <div className="wide"><span className="data-field-label">Salidas</span><span className="mono">{renderList(localService.dictionary_data?.outputs)}</span></div>
        <div className="wide"><span className="data-field-label">Invoca</span><span className="mono">{renderList(localService.dictionary_data?.invokes)}</span></div>
        <div className="wide"><span className="data-field-label">Tablas referenciales</span><span className="mono">{renderList(localService.dictionary_data?.reference_tables)}</span></div>
      </div>
    </div>
  );

  const finalResultBox = (
    <div className="data-card accent-moss">
      <h3>
        Resultado para el diccionario
        <span className="stamp stamp-moss">Listo para cerrar</span>
      </h3>

      <div className="data-grid">
        <div><span className="data-field-label">App</span><span className="mono">{finalData.app || 'N/A'}</span></div>
        <div><span className="data-field-label">Tipo</span><span className="mono">{finalData.type || 'N/A'}</span></div>
        <div><span className="data-field-label">Verbo</span><span className="mono">{finalData.verb || 'N/A'}</span></div>
        <div><span className="data-field-label">Ámbito</span>{finalData.scope || 'N/A'}</div>
        <div><span className="data-field-label">Fiabilidad</span>{finalData.reliability || 'N/A'}</div>
        <div><span className="data-field-label">Documento</span>{finalData.source_document || 'N/A'} <span className="mono">v{finalData.doc_version || '-'}</span></div>

        <div className="data-field-block">
          <span className="data-field-label">Uso funcional</span>
          {finalData.functional_use || 'N/A'}
        </div>

        <div className="wide"><span className="data-field-label">Entradas</span><span className="mono">{renderList(finalData.inputs)}</span></div>
        <div className="wide"><span className="data-field-label">Salidas</span><span className="mono">{renderList(finalData.outputs)}</span></div>
        <div className="wide"><span className="data-field-label">Invoca</span><span className="mono">{renderList(finalData.invokes)}</span></div>
        <div className="wide"><span className="data-field-label">Tablas referenciales</span><span className="mono">{renderList(finalData.reference_tables)}</span></div>
      </div>

      <div className="buttons" style={{ marginTop: '20px' }}>
        <button
          className="btn-accept"
          disabled={resolvingId === 'accept-close'}
          onClick={requestAcceptPreview}
        >
          {resolvingId === 'accept-close' ? 'Calculando...' : 'Aceptar cambios'}
        </button>
        <button
          className="btn-quiet"
          style={{ flex: 1, textAlign: 'center' }}
          disabled={resolvingId === 'reset'}
          onClick={resetServiceConflicts}
        >
          {resolvingId === 'reset' ? 'Aplicando...' : 'Reiniciar conflicto'}
        </button>
        <button
          className="btn-reject"
          disabled={resolvingId === 'reject-service'}
          onClick={rejectService}
        >
          {resolvingId === 'reject-service' ? 'Aplicando...' : 'Rechazar servicio'}
        </button>
      </div>
    </div>
  );

  // Para servicios nuevos: solo el dato y la decisión de aceptar/rechazar, sin
  // hablar de "revisión completada" (no había nada del Diccionario que revisar)
  const newServiceResultBox = (
    <div className="data-card">
      <h3>Datos del servicio</h3>

      <div className="data-grid">
        <div><span className="data-field-label">App</span><span className="mono">{finalData.app || 'N/A'}</span></div>
        <div><span className="data-field-label">Tipo</span><span className="mono">{finalData.type || 'N/A'}</span></div>
        <div><span className="data-field-label">Verbo</span><span className="mono">{finalData.verb || 'N/A'}</span></div>
        <div><span className="data-field-label">Ámbito</span>{finalData.scope || 'N/A'}</div>
        <div><span className="data-field-label">Fiabilidad</span>{finalData.reliability || 'N/A'}</div>
        <div><span className="data-field-label">Documento</span>{finalData.source_document || 'N/A'} <span className="mono">v{finalData.doc_version || '-'}</span></div>

        <div className="data-field-block">
          <span className="data-field-label">Uso funcional</span>
          {finalData.functional_use || 'N/A'}
        </div>

        <div className="wide"><span className="data-field-label">Entradas</span><span className="mono">{renderList(finalData.inputs)}</span></div>
        <div className="wide"><span className="data-field-label">Salidas</span><span className="mono">{renderList(finalData.outputs)}</span></div>
        <div className="wide"><span className="data-field-label">Invoca</span><span className="mono">{renderList(finalData.invokes)}</span></div>
        <div className="wide"><span className="data-field-label">Tablas referenciales</span><span className="mono">{renderList(finalData.reference_tables)}</span></div>
      </div>

      <div className="buttons" style={{ marginTop: '20px' }}>
        <button
          className="btn-accept"
          disabled={resolvingId === 'accept-close'}
          onClick={requestAcceptPreview}
        >
          {resolvingId === 'accept-close' ? 'Calculando...' : 'Aceptar'}
        </button>
        <button
          className="btn-reject"
          disabled={resolvingId === 'reject-service'}
          onClick={rejectService}
        >
          {resolvingId === 'reject-service' ? 'Aplicando...' : 'Rechazar'}
        </button>
      </div>
    </div>
  );

  const observationsBox = (
    <div className="note-block" style={{ marginBottom: '24px' }}>
      <h4 className="subhead">Observaciones</h4>
      <textarea
        value={observations}
        onChange={(e) => setObservations(e.target.value)}
        placeholder="Añade aquí cualquier nota u observación sobre este servicio (opcional)..."
        rows={3}
        style={{
          width: '100%', padding: '10px', borderRadius: '2px',
          border: '1px solid var(--rule)', fontSize: '13px',
          fontFamily: 'inherit', resize: 'vertical'
        }}
      />
      <div style={{ marginTop: '10px', textAlign: 'right' }}>
        <button
          className="btn-quiet"
          disabled={savingObservations}
          onClick={saveObservations}
        >
          {savingObservations ? 'Guardando...' : 'Guardar observaciones'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="iteration-review">
      <h2 style={{ marginBottom: '4px', color: 'var(--ink)', fontSize: '17px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className="mono">{localService.service_name}</span>
        <span className={`stamp ${statusStampClass}`}>{localService.status}</span>
      </h2>

      {isNewService && (
        <div className="info-line" style={{ marginTop: '16px' }}>
          <span className="stamp stamp-amber">Nuevo</span>
          <span>No existe en el Diccionario Maestro — es un servicio nuevo detectado en el perímetro.</span>
        </div>
      )}

      <div style={{ marginTop: isNewService ? '16px' : '20px' }}>

      {localService.perimeter_iterations.length === 0 ? (
        <>
          {!isNewService && dictionaryBox}
          <div className="empty" style={{ border: '1px solid var(--rule)', borderRadius: '3px', background: 'white', marginTop: '24px' }}>
            No hay iteraciones registradas para este servicio.
          </div>
        </>
      ) : allResolved ? (
        isNewService ? (
          newServiceResultBox
        ) : (
          /* Diccionario y resultado final lado a lado, una vez revisados todos los conflictos */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {dictionaryBox}
            {finalResultBox}
          </div>
        )
      ) : (
        <>
          {!isNewService && <div style={{ marginBottom: '24px' }}>{dictionaryBox}</div>}
          {currentIteration && (
          <div key={currentIteration.iteration_id} className="field-diff">

            <div className="iteration-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Asiento {currentIteration.iteration_id}</span>
              <span className="folio-count">Punto {currentPosition} de {totalConflictIterations}</span>
            </div>

            {/* Datos detallados de la iteración actual */}
            <div style={{ margin: '18px 0' }}>
              <h4 className="subhead">Datos capturados del perímetro</h4>
              <div className="data-grid">
                <div><span className="data-field-label">App</span><span className="mono">{currentIteration.data.app || 'N/A'}</span></div>
                <div><span className="data-field-label">Tipo</span><span className="mono">{currentIteration.data.type || 'N/A'}</span></div>
                <div><span className="data-field-label">Verbo</span><span className="mono">{currentIteration.data.verb || 'N/A'}</span></div>
                <div><span className="data-field-label">Ámbito</span>{currentIteration.data.scope || 'N/A'}</div>
                <div><span className="data-field-label">Fiabilidad</span>{currentIteration.data.reliability || 'N/A'}</div>
                <div><span className="data-field-label">Documento</span>{currentIteration.data.source_document || 'N/A'} <span className="mono">v{currentIteration.data.doc_version || '-'}</span></div>

                <div className="data-field-block">
                  <span className="data-field-label">Uso funcional</span>
                  {currentIteration.data.functional_use || 'N/A'}
                </div>

                <div className="wide"><span className="data-field-label">Entradas</span><span className="mono">{renderList(currentIteration.data.inputs)}</span></div>
                <div className="wide"><span className="data-field-label">Salidas</span><span className="mono">{renderList(currentIteration.data.outputs)}</span></div>
                <div className="wide"><span className="data-field-label">Invoca</span><span className="mono">{renderList(currentIteration.data.invokes)}</span></div>
                <div className="wide"><span className="data-field-label">Tablas referenciales</span><span className="mono">{renderList(currentIteration.data.reference_tables)}</span></div>
              </div>
            </div>

            {/* Mapeo de Conflictos */}
            <div className="conflict-block">
                <h4 className="subhead" style={{ marginBottom: '16px' }}>
                  Conflictos detectados ({currentIteration.conflicts.length})
                </h4>

                {currentIteration.conflicts.map((conflict, idx) => (
                  <div key={idx} className="conflict-row">
                    <div className="field-name">
                      <span className="mono">{conflict.column === 'document' ? 'documento + versión' : conflict.column}</span>
                    </div>
                    <div className="field-values">
                      <div className="value-box">
                        <div className="label">Valor anterior</div>
                        <div style={{ color: 'var(--text-muted)' }}>
                          {conflict.original || 'N/D'}
                        </div>
                      </div>
                      <div className="value-box">
                        <div className="label">Nueva propuesta</div>
                        <div style={{ color: 'var(--ink)', fontWeight: 600 }}>
                          {conflict.proposed || 'N/D'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="buttons">
                  <button
                    className="btn-unify"
                    disabled={resolvingId === currentIteration.iteration_id}
                    onClick={() => resolveIteration(currentIteration.iteration_id, 'unify')}
                  >
                    {resolvingId === currentIteration.iteration_id ? 'Aplicando...' : 'Unificar'}
                  </button>
                  <button
                    className="btn-reject"
                    disabled={resolvingId === currentIteration.iteration_id}
                    onClick={() => resolveIteration(currentIteration.iteration_id, 'reject')}
                  >
                    {resolvingId === currentIteration.iteration_id ? 'Aplicando...' : 'Rechazar cambios'}
                  </button>
                </div>
              </div>

            {/* Observaciones propias de esta iteración */}
            <div className="note-block" style={{ marginTop: '16px' }}>
              <h4 className="subhead" style={{ marginBottom: '8px' }}>Observaciones de esta iteración</h4>
              <textarea
                value={iterationObservations}
                onChange={(e) => setIterationObservations(e.target.value)}
                placeholder="Notas sobre esta iteración (opcional)..."
                rows={2}
                style={{
                  width: '100%', padding: '8px', borderRadius: '2px',
                  border: '1px solid var(--rule)', fontSize: '13px',
                  fontFamily: 'inherit', resize: 'vertical'
                }}
              />
              <div style={{ marginTop: '8px', textAlign: 'right' }}>
                <button
                  className="btn-quiet"
                  disabled={savingIterationObservations}
                  onClick={() => saveIterationObservations(currentIteration.iteration_id)}
                >
                  {savingIterationObservations ? 'Guardando...' : 'Guardar observaciones'}
                </button>
              </div>
            </div>

            </div>
          )}
        </>
      )}

      {resolvedIterations.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h4 className="subhead">Asientos ya revisados</h4>
          {resolvedIterations.map(it => {
            const stamp = resolutionStamp(it.resolution);
            return (
              <div
                key={it.iteration_id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: 'white', border: '1px solid var(--rule)',
                  marginBottom: '8px', fontSize: '13px'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="mono">Asiento {it.iteration_id}</span>
                  <span className={`stamp ${stamp.cls}`}>{stamp.label}</span>
                </span>
                <button
                  className="btn-quiet"
                  disabled={resolvingId === it.iteration_id}
                  onClick={() => revertIteration(it.iteration_id)}
                >
                  {resolvingId === it.iteration_id ? 'Aplicando...' : 'Volver atrás'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {isNewService && <div style={{ marginTop: '20px' }}>{observationsBox}</div>}

      </div>

      {previewData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(21,48,47,0.55)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 2000, padding: '20px'
        }}>
          <div style={{
            background: 'white', borderRadius: '4px', padding: '24px',
            maxWidth: '640px', width: '100%', maxHeight: '85vh', overflowY: 'auto',
            border: '1px solid var(--rule)'
          }}>
            <h3 style={{ color: 'var(--ink)', marginBottom: '6px', fontSize: '15px', fontWeight: 600 }}>
              Así quedará en el Diccionario
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
              Resultado de unir la revisión final de <strong className="mono">{localService.service_name}</strong> con el dato maestro actual del Diccionario. Nada se elimina ni se sobrescribe.
            </p>

            <div className="data-grid">
              <div><span className="data-field-label">App</span><span className="mono">{previewData.app || 'N/A'}</span></div>
              <div><span className="data-field-label">Tipo</span><span className="mono">{previewData.type || 'N/A'}</span></div>
              <div><span className="data-field-label">Verbo</span><span className="mono">{previewData.verb || 'N/A'}</span></div>
              <div><span className="data-field-label">Ámbito</span>{previewData.scope || 'N/A'}</div>
              <div><span className="data-field-label">Fiabilidad</span>{previewData.reliability || 'N/A'}</div>
              <div><span className="data-field-label">Documento</span>{previewData.source_document || 'N/A'} <span className="mono">v{previewData.doc_version || '-'}</span></div>

              <div className="data-field-block">
                <span className="data-field-label">Uso funcional</span>
                {previewData.functional_use || 'N/A'}
              </div>

              <div className="wide"><span className="data-field-label">Entradas</span><span className="mono">{renderList(previewData.inputs)}</span></div>
              <div className="wide"><span className="data-field-label">Salidas</span><span className="mono">{renderList(previewData.outputs)}</span></div>
              <div className="wide"><span className="data-field-label">Invoca</span><span className="mono">{renderList(previewData.invokes)}</span></div>
              <div className="wide"><span className="data-field-label">Tablas referenciales</span><span className="mono">{renderList(previewData.reference_tables)}</span></div>
            </div>

            <div className="buttons" style={{ marginTop: '24px' }}>
              <button
                className="btn-accept"
                disabled={resolvingId === 'accept-close'}
                onClick={confirmAcceptAndClose}
              >
                {resolvingId === 'accept-close' ? 'Aplicando...' : 'Confirmar y cerrar'}
              </button>
              <button
                className="btn-quiet"
                style={{ flex: 1, textAlign: 'center' }}
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
          background: toast.startsWith('❌') ? 'var(--rust)' : 'var(--ink)',
          color: 'white',
          padding: '13px 18px',
          borderRadius: '2px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
          fontWeight: 500,
          fontSize: '13.5px',
          zIndex: 1000
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
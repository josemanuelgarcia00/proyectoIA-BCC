import React, { useState, useEffect } from 'react';
import * as servicesApi from '../api/servicesApi';

function ListEditor({ items, onChange, label }) {
  const list = Array.isArray(items) ? items : [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', position: 'relative' }}>
      <button
        type="button"
        onClick={() => onChange([...list, ''])}
        title="Añadir"
        style={{ position: 'absolute', top: 0, right: 0, width: '18px', height: '18px', cursor: 'pointer', border: '1px solid #2e7d32', borderRadius: '2px', background: '#2e7d32', color: 'white', fontWeight: 700, fontSize: '13px', lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >+</button>
      <span className="data-field-label" style={{ margin: 0, marginBottom: '4px', paddingRight: '22px' }}>{label || ''}</span>
      {list.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <input
            type="text"
            value={item}
            onChange={(e) => {
              const next = [...list];
              next[idx] = e.target.value;
              onChange(next);
            }}
            style={{ width: '80%', padding: '4px 7px', fontSize: '13px', border: '1px solid var(--rule)', borderRadius: '2px', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
          <button
            type="button"
            onClick={() => onChange(list.filter((_, i) => i !== idx))}
            title="Eliminar"
            style={{ width: '20%', padding: '2px 4px', fontSize: '10px', lineHeight: 1, cursor: 'pointer', border: '1px solid var(--rule)', borderRadius: '2px', background: 'white', color: 'var(--rust, #c0392b)' }}
          >Eliminar</button>
        </div>
      ))}
    </div>
  );
}

const STATUS_STAMP = {
  'Aceptado': 'stamp-moss',
  'Unificado': 'stamp-moss',
  'Cerrado': 'stamp-moss',
  'Desechado': 'stamp-rust',
  'En revision': 'stamp-amber'
};

export default function IterationReview({ service, onServiceClosed }) {
  const [localService, setLocalService] = useState(service);
  const [toast, setToast] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [rejectObservations, setRejectObservations] = useState('');
  const [localEdits, setLocalEdits] = useState({});
  const [savingEdits, setSavingEdits] = useState(false);

  const dataToEdits = (data) => ({
    app: data.app || '',
    type: data.type || '',
    verb: data.verb || '',
    scope: data.scope || '',
    functional_use: data.functional_use || '',
    inputs: data.inputs || [],
    outputs: data.outputs || [],
    invokes: data.invokes || [],
    reference_tables: data.reference_tables || [],
  });

  // Cuando se selecciona otro servicio en la lista, reiniciamos el estado local
  useEffect(() => {
    setLocalService(service);
    setToast(null);
    setPreviewData(null);

    // Inicializar localEdits desde el prop directamente: evita el bug de stale
    // dependency cuando dos servicios distintos comparten el mismo currentIterationId
    // (ej. ambos tienen iteration_id=1 pendiente) y Effect 2 no se re-ejecuta.
    const newVisible = (service?.perimeter_iterations || []).filter(
      it => it.conflicts && it.conflicts.length > 0
    );
    const firstIt = newVisible[0];
    if (firstIt) {
      setLocalEdits(dataToEdits(firstIt.data));
    } else {
      const last = (service?.perimeter_iterations || []).slice(-1)[0] ?? null;
      if (!service?.is_in_dictionary && last) {
        setLocalEdits(dataToEdits(last.data));
      } else {
        setLocalEdits({});
      }
    }
  }, [service]);

  // Solo interesa mostrar iteraciones con conflictos pendientes de revisar
  const visibleIterationsEarly = (localService?.perimeter_iterations || []).filter(
    it => it.conflicts && it.conflicts.length > 0
  );
  const currentIterationId = visibleIterationsEarly[0]?.iteration_id ?? null;

  // Inicializar edits cuando la iteración activa cambia
  useEffect(() => {
    const it = visibleIterationsEarly[0];
    if (it) {
      setLocalEdits(dataToEdits(it.data));
    } else {
      // Para servicios nuevos sin conflictos pendientes, inicializar desde la última iteración
      const last = localService?.perimeter_iterations?.length > 0
        ? localService.perimeter_iterations[localService.perimeter_iterations.length - 1]
        : null;
      if (!localService?.is_in_dictionary && last) {
        setLocalEdits(dataToEdits(last.data));
      } else {
        setLocalEdits({});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIterationId]);

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
      const updated = await servicesApi.resolveIteration(localService.service_name, iterationId, resolution);
      setLocalService(updated);
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
      const updated = await servicesApi.revertIteration(localService.service_name, iterationId);
      setLocalService(updated);
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
      const updated = await servicesApi.resetConflicts(localService.service_name);
      setLocalService(updated);
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
      const preview = await servicesApi.previewAccept(localService.service_name);
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
      await servicesApi.acceptAndClose(localService.service_name);
      setPreviewData(null);
      showToast(`✅ ${localService.service_name} aceptado y cerrado`);
      if (onServiceClosed) onServiceClosed(localService.service_name);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setResolvingId(null);
    }
  };

  const rejectService = () => {
    setRejectObservations('');
    setConfirmDialog({
      title: 'Rechazar servicio',
      message: `¿Seguro que quieres rechazar "${localService.service_name}"? No se incorporará al Diccionario.`,
      confirmLabel: 'Rechazar',
      withObservations: true,
      onConfirm: performRejectService
    });
  };

  const performRejectService = async (observations) => {
    setConfirmDialog(null);
    setResolvingId('reject-service');
    try {
      const iterations = localService?.perimeter_iterations || [];
      const targetIteration = iterations[iterations.length - 1] || null;
      if (observations && targetIteration) {
        await servicesApi.updateIterationObservations(
          localService.service_name, targetIteration.iteration_id, observations
        );
      }
      await servicesApi.rejectService(localService.service_name);
      showToast(`❌ ${localService.service_name} rechazado`);
      if (onServiceClosed) onServiceClosed(localService.service_name);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setResolvingId(null);
    }
  };

  const saveIterationEdits = async (iterationId) => {
    setSavingEdits(true);
    try {
      const toArr = (v) => Array.isArray(v) ? v.filter(Boolean) : (v || '').split(/[;,]/).map((s) => s.trim()).filter(Boolean);
      const dataToSave = {
        app: localEdits.app,
        type: localEdits.type,
        verb: localEdits.verb,
        scope: localEdits.scope,
        functional_use: localEdits.functional_use,
        inputs: toArr(localEdits.inputs),
        outputs: toArr(localEdits.outputs),
        invokes: toArr(localEdits.invokes),
        reference_tables: toArr(localEdits.reference_tables),
      };
      const updated = await servicesApi.updateIterationData(localService.service_name, iterationId, dataToSave);
      setLocalService(updated);
      showToast('✅ Cambios guardados');
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setSavingEdits(false);
    }
  };

  const rejectIterationWithConfirm = (iterationId) => {
    setRejectObservations('');
    setConfirmDialog({
      title: 'Rechazar cambios de la iteración',
      message: `¿Seguro que quieres descartar los cambios de la iteración ${iterationId}?`,
      confirmLabel: 'Rechazar cambios',
      withObservations: true,
      onConfirm: (observations) => performRejectIteration(iterationId, observations)
    });
  };

  const performRejectIteration = async (iterationId, observations) => {
    setConfirmDialog(null);
    setResolvingId(iterationId);
    try {
      if (observations) {
        await servicesApi.updateIterationObservations(
          localService.service_name, iterationId, observations
        );
      }
      const updated = await servicesApi.resolveIteration(localService.service_name, iterationId, 'reject');
      setLocalService(updated);
      showToast(`✅ Iteración ${iterationId} rechazada`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setResolvingId(null);
    }
  };

  const visibleIterations = localService.perimeter_iterations.filter(
    it => it.conflicts && it.conflicts.length > 0
  );

  // Última iteración = dato consolidado que pasaría al Diccionario una vez revisado
  // todo, y también la iteración que se rechazaría por completo si se rechaza el servicio
  const lastIteration = localService.perimeter_iterations.length > 0
    ? localService.perimeter_iterations[localService.perimeter_iterations.length - 1]
    : null;
  const finalData = lastIteration?.data || null;

  // Cuando ya no quedan conflictos pendientes, mostramos diccionario y resultado final lado a lado
  const allResolved = localService.perimeter_iterations.length > 0 && visibleIterations.length === 0;

  // Servicio nuevo: no existe en el Diccionario Maestro, solo se puede aceptar o rechazar
  const isNewService = !localService.is_in_dictionary;

  // Iteraciones ya revisadas (con resolución persistida), para poder volver atrás
  // una a una. A diferencia de antes, esto no depende de un estado local que se
  // reinicia al salir y volver a entrar al servicio: se basa en el dato guardado.
  const resolvedIterations = localService.perimeter_iterations.filter(
    it => it.resolution != null
  );

  // Solo se muestra una iteración con conflictos a la vez (la siguiente aparece
  // al resolver la actual), manteniendo siempre su iteration_id original.
  const currentIteration = visibleIterations[0] || null;
  const currentIndex = currentIteration
    ? localService.perimeter_iterations.findIndex(it => it.iteration_id === currentIteration.iteration_id)
    : -1;
  const previousIteration = currentIndex > 0
    ? localService.perimeter_iterations[currentIndex - 1]
    : null;
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
        <div><span className="data-field-label">App</span><span className="mono">{finalData?.app || 'N/A'}</span></div>
        <div><span className="data-field-label">Tipo</span><span className="mono">{finalData?.type || 'N/A'}</span></div>
        <div><span className="data-field-label">Verbo</span><span className="mono">{finalData?.verb || 'N/A'}</span></div>
        <div><span className="data-field-label">Ámbito</span>{finalData?.scope || 'N/A'}</div>
        <div><span className="data-field-label">Fiabilidad</span>{finalData?.reliability || 'N/A'}</div>
        <div><span className="data-field-label">Documento</span>{finalData?.source_document || 'N/A'} <span className="mono">v{finalData?.doc_version || '-'}</span></div>

        <div className="data-field-block">
          <span className="data-field-label">Uso funcional</span>
          {finalData?.functional_use || 'N/A'}
        </div>

        <div className="wide"><span className="data-field-label">Entradas</span><span className="mono">{renderList(finalData?.inputs)}</span></div>
        <div className="wide"><span className="data-field-label">Salidas</span><span className="mono">{renderList(finalData?.outputs)}</span></div>
        <div className="wide"><span className="data-field-label">Invoca</span><span className="mono">{renderList(finalData?.invokes)}</span></div>
        <div className="wide"><span className="data-field-label">Tablas referenciales</span><span className="mono">{renderList(finalData?.reference_tables)}</span></div>
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

  // Para servicios nuevos: todos los campos editables salvo el documento de origen
  const newServiceResultBox = (() => {
    const inp = (field) => (
      <input
        type="text"
        value={localEdits[field] ?? ''}
        onChange={(e) => setLocalEdits((p) => ({ ...p, [field]: e.target.value }))}
        style={{ width: '100%', padding: '4px 7px', fontSize: '13px', border: '1px solid var(--rule)', borderRadius: '2px', fontFamily: 'inherit', boxSizing: 'border-box' }}
      />
    );
    return (
      <div className="data-card">
        <h3>Datos del servicio</h3>

        <div className="data-grid">
          <div><label className="data-field-label">App</label>{inp('app')}</div>
          <div><label className="data-field-label">Tipo</label>{inp('type')}</div>
          <div><label className="data-field-label">Verbo</label>{inp('verb')}</div>
          <div><label className="data-field-label">Ámbito</label>{inp('scope')}</div>
          <div><span className="data-field-label">Fiabilidad</span>{finalData?.reliability || 'N/A'}</div>
          <div><span className="data-field-label">Documento</span>{finalData?.source_document || 'N/A'} <span className="mono">v{finalData?.doc_version || '-'}</span></div>

          <div className="wide data-field-block">
            <label className="data-field-label">Uso funcional</label>
            <textarea
              rows={3}
              value={localEdits.functional_use ?? ''}
              onChange={(e) => setLocalEdits((p) => ({ ...p, functional_use: e.target.value }))}
              style={{ width: '100%', padding: '4px 7px', fontSize: '13px', border: '1px solid var(--rule)', borderRadius: '2px', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </div>
          <div className="wide" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
            <ListEditor label="Entradas" items={localEdits.inputs || []} onChange={(v) => setLocalEdits((p) => ({ ...p, inputs: v }))} />
            <ListEditor label="Salidas" items={localEdits.outputs || []} onChange={(v) => setLocalEdits((p) => ({ ...p, outputs: v }))} />
            <ListEditor label="Invoca" items={localEdits.invokes || []} onChange={(v) => setLocalEdits((p) => ({ ...p, invokes: v }))} />
            <ListEditor label="Tablas referenciales" items={localEdits.reference_tables || []} onChange={(v) => setLocalEdits((p) => ({ ...p, reference_tables: v }))} />
          </div>
        </div>

        <div className="buttons" style={{ marginTop: '20px', justifyContent: 'space-between' }}>
          <button
            className="btn-quiet"
            disabled={savingEdits}
            onClick={() => saveIterationEdits(lastIteration.iteration_id)}
            style={{ fontSize: '12px', padding: '4px 12px' }}
          >
            {savingEdits ? 'Guardando...' : 'Mantener estado'}
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
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
      </div>
    );
  })();

  const previousIterationBox = previousIteration ? (
    <div className="data-card accent-primary">
      <h3>Iteración anterior</h3>
      <div className="data-grid">
        <div><span className="data-field-label">App</span><span className="mono">{previousIteration.data?.app || 'N/A'}</span></div>
        <div><span className="data-field-label">Tipo</span><span className="mono">{previousIteration.data?.type || 'N/A'}</span></div>
        <div><span className="data-field-label">Verbo</span><span className="mono">{previousIteration.data?.verb || 'N/A'}</span></div>
        <div><span className="data-field-label">Ámbito</span>{previousIteration.data?.scope || 'N/A'}</div>
        <div><span className="data-field-label">Fiabilidad</span>{previousIteration.data?.reliability || 'N/A'}</div>
        <div><span className="data-field-label">Documento</span>{previousIteration.data?.source_document || 'N/A'} <span className="mono">v{previousIteration.data?.doc_version || '-'}</span></div>
        <div className="data-field-block">
          <span className="data-field-label">Uso funcional</span>
          {previousIteration.data?.functional_use || 'N/A'}
        </div>
        <div className="wide"><span className="data-field-label">Entradas</span><span className="mono">{renderList(previousIteration.data?.inputs)}</span></div>
        <div className="wide"><span className="data-field-label">Salidas</span><span className="mono">{renderList(previousIteration.data?.outputs)}</span></div>
        <div className="wide"><span className="data-field-label">Invoca</span><span className="mono">{renderList(previousIteration.data?.invokes)}</span></div>
        <div className="wide"><span className="data-field-label">Tablas referenciales</span><span className="mono">{renderList(previousIteration.data?.reference_tables)}</span></div>
      </div>
    </div>
  ) : null;

  return (
    <div className="iteration-review">
      <h2 style={{ marginBottom: '4px', color: 'var(--ink)', fontSize: '17px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className="mono">{localService.service_name}</span>
        <span className={`stamp ${statusStampClass}`}>{localService.status}</span>
      </h2>

      {isNewService && (allResolved || visibleIterations.length === 0) && (
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
          {!isNewService
            ? <div style={{ marginBottom: '24px' }}>{dictionaryBox}</div>
            : previousIteration && <div style={{ marginBottom: '24px' }}>{previousIterationBox}</div>
          }
          {currentIteration && (
          <div key={currentIteration.iteration_id} className="field-diff">

            <div className="iteration-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Iteración {currentIteration.iteration_id}
                {isNewService && <span className="stamp stamp-amber">Nuevo</span>}
              </span>
              <span className="folio-count">Punto {currentPosition} de {totalConflictIterations}</span>
            </div>

            {/* Datos de la iteración — solo lectura */}
            <div style={{ margin: '18px 0' }}>
              <h4 className="subhead" style={{ marginBottom: '12px' }}>Datos capturados del perímetro</h4>
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

                {(() => {
                  const EDITABLE_FIELDS = new Set(['app','type','verb','scope','functional_use','inputs','outputs','invokes','reference_tables']);
                  const LIST_FIELDS = new Set(['inputs','outputs','invokes','reference_tables']);
                  const FIELD_LABELS = {
                    document: 'documento + versión',
                    reliability: 'fiabilidad',
                    app: 'app',
                    type: 'tipo',
                    verb: 'verbo',
                    scope: 'ámbito',
                    functional_use: 'uso funcional',
                    inputs: 'entradas',
                    outputs: 'salidas',
                    invokes: 'invoca',
                    reference_tables: 'tablas referenciales',
                  };
                  return currentIteration.conflicts.map((conflict, idx) => {
                    const isEditable = EDITABLE_FIELDS.has(conflict.column);
                    const isList = LIST_FIELDS.has(conflict.column);
                    return (
                      <div key={idx} className="conflict-row">
                        <div className="field-name">
                          <span className="mono">{FIELD_LABELS[conflict.column] ?? conflict.column}</span>
                        </div>
                        <div className="field-values">
                          <div className="value-box">
                            <div className="label">Valor anterior</div>
                            <div style={{ color: 'var(--text-muted)' }}>
                              {conflict.original || 'N/D'}
                            </div>
                          </div>
                          <div className="value-box">
                            {isEditable && isList ? (
                              <ListEditor
                                label="Nueva propuesta"
                                items={localEdits[conflict.column] || []}
                                onChange={(v) => setLocalEdits((p) => ({ ...p, [conflict.column]: v }))}
                              />
                            ) : <div className="label">Nueva propuesta</div>}
                            {isEditable && !isList && (
                              <input
                                type="text"
                                value={localEdits[conflict.column] ?? ''}
                                onChange={(e) => setLocalEdits((p) => ({ ...p, [conflict.column]: e.target.value }))}
                                style={{ width: '100%', padding: '4px 7px', fontSize: '13px', border: '1px solid var(--rule)', borderRadius: '2px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                              />
                            )}
                            {!isEditable && (
                              <div style={{ color: 'var(--ink)', fontWeight: 600 }}>
                                {conflict.proposed || 'N/D'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}

                <div className="buttons" style={{ justifyContent: 'space-between' }}>
                  <button
                    className="btn-quiet"
                    disabled={savingEdits}
                    onClick={() => saveIterationEdits(currentIteration.iteration_id)}
                    style={{ fontSize: '12px', padding: '4px 12px' }}
                  >
                    {savingEdits ? 'Guardando...' : 'Mantener estado'}
                  </button>
                  <div style={{ display: 'flex', gap: '10px' }}>
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
                      onClick={() => rejectIterationWithConfirm(currentIteration.iteration_id)}
                    >
                      {resolvingId === currentIteration.iteration_id ? 'Aplicando...' : 'Rechazar cambios'}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}
        </>
      )}

      {resolvedIterations.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h4 className="subhead">Iteraciones ya revisadas</h4>
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
                  <span className="mono">Iteración {it.iteration_id}</span>
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

      {confirmDialog && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(21,48,47,0.55)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 2100, padding: '20px'
        }}>
          <div style={{
            background: 'white', borderRadius: '4px', padding: '24px',
            maxWidth: '440px', width: '100%',
            border: '1px solid var(--rule)'
          }}>
            <h3 style={{ color: 'var(--ink)', marginBottom: '10px', fontSize: '15px', fontWeight: 600 }}>
              {confirmDialog.title}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: confirmDialog.withObservations ? '0' : '20px' }}>
              {confirmDialog.message}
            </p>

            {confirmDialog.withObservations && (
              <div style={{ marginTop: '16px', marginBottom: '20px' }}>
                <label style={{
                  display: 'block', fontSize: '12px', color: 'var(--text-muted)',
                  marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px'
                }}>
                  Observaciones (opcional)
                </label>
                <textarea
                  value={rejectObservations}
                  onChange={(e) => setRejectObservations(e.target.value)}
                  placeholder="Motivo del rechazo u otras notas..."
                  rows={3}
                  style={{
                    width: '100%', padding: '8px', borderRadius: '2px',
                    border: '1px solid var(--rule)', fontSize: '13px',
                    fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            <div className="buttons">
              <button className="btn-reject" onClick={() => confirmDialog.onConfirm(rejectObservations)}>
                {confirmDialog.confirmLabel || 'Confirmar'}
              </button>
              <button
                className="btn-quiet"
                style={{ flex: 1, textAlign: 'center' }}
                onClick={() => setConfirmDialog(null)}
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
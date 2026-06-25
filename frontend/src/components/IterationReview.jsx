import React, { useState, useEffect } from 'react';
import * as servicesApi from '../api/servicesApi';
import { APP_CODES, FIELD_ENUM_OPTIONS } from '../domain/enums';

function ListEditor({ items, onChange, label, error, onBlur }) {
  const list = Array.isArray(items) ? items : [];

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', position: 'relative' }}>
      <button
        type="button"
        onClick={() => onChange([...list, ''])}
        title="Añadir"
        style={{ position: 'absolute', top: 0, right: 0, width: '18px', height: '18px', cursor: 'pointer', border: '1px solid #2e7d32', borderRadius: '2px', background: '#2e7d32', color: 'white', fontWeight: 700, fontSize: '13px', lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >+</button>
      <span className="data-field-label" style={{ margin: 0, marginBottom: '4px', paddingRight: '22px' }}>{label || ''}</span>
      {list.length === 0 && (
        <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>N/D</span>
      )}
      <div className="list-editor-items">
        {list.map((item, idx) => {
          const hasItemError = emptyIndices.has(idx) || dupeIndices.has(idx);
          return (
            <div key={idx} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input
                type="text"
                value={item}
                onChange={(e) => {
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
                onClick={() => onChange(list.filter((_, i) => i !== idx))}
                title="Eliminar"
                style={{ flex: 'none', padding: '4px 8px', fontSize: '11px', lineHeight: 1, cursor: 'pointer', border: '1px solid var(--rule)', borderRadius: '2px', background: 'white', color: 'var(--rust, #c0392b)', fontWeight: 600 }}
              >Eliminar</button>
            </div>
          );
        })}
      </div>
      {error && (
        <span className={error.startsWith('__warning__') ? 'field-warning-msg' : 'field-error-msg'}>
          {error.replace('__warning__', '')}
        </span>
      )}
    </div>
  );
}

const FIELD_INPUT_STYLE = {
  width: '100%', padding: '4px 7px', fontSize: '13px',
  borderRadius: '2px', fontFamily: 'inherit', boxSizing: 'border-box',
};

function FixedSelect({ value, onChange, onBlur, options, className }) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef(null);
  const normalize = (opt) => typeof opt === 'string' ? { value: opt, label: opt } : opt;
  const opts = options.map(normalize);
  const selected = opts.find((o) => o.value === value);
  const isError = className === 'input-error';

  React.useEffect(() => {
    const close = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const select = (val) => { onChange(val); setOpen(false); };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => { setTimeout(() => setOpen(false), 150); if (onBlur) onBlur(); }}
        style={{
          ...FIELD_INPUT_STYLE,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          textAlign: 'left', background: 'white', cursor: 'pointer', fontWeight: 'normal',
          border: `1px solid ${isError ? 'var(--rust, #c0392b)' : 'var(--rule)'}`,
          color: selected ? 'var(--ink)' : 'var(--text-muted)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : '— Seleccionar —'}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '6px' }}>▼</span>
      </button>
      {open && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'white', border: '1px solid var(--rule)', borderTop: 'none',
          borderRadius: '0 0 2px 2px', margin: 0, padding: 0, listStyle: 'none',
          maxHeight: '142px', overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
        }}>
          {opts.map((o) => (
            <li
              key={o.value}
              onMouseDown={() => select(o.value)}
              style={{
                padding: '6px 10px', fontSize: '13px', cursor: 'pointer',
                borderBottom: '1px solid var(--rule)',
                color: o.value === value ? 'var(--primary-dark, #1a6b3c)' : 'var(--ink)',
                background: o.value === value ? 'var(--primary-faint, #f0f8f4)' : 'white',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary-faint, #f0f8f4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = o.value === value ? 'var(--primary-faint, #f0f8f4)' : 'white'; }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AppCodeInput({ value, onChange, onBlur, className }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState(value ?? '');
  const containerRef = React.useRef(null);

  React.useEffect(() => { setQuery(value ?? ''); }, [value]);

  React.useEffect(() => {
    const close = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const filtered = query ? APP_CODES.filter((c) => c.startsWith(query)) : APP_CODES;

  const select = (code) => { setQuery(code); onChange(code); setOpen(false); };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
          setQuery(v);
          onChange(v);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setTimeout(() => setOpen(false), 150); if (onBlur) onBlur(); }}
        maxLength={3}
        placeholder="Código (3 letras, ej: ACG)"
        className={className}
        style={{ ...FIELD_INPUT_STYLE, letterSpacing: '2px' }}
      />
      {open && filtered.length > 0 && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'white', border: '1px solid var(--rule)', borderTop: 'none',
          borderRadius: '0 0 2px 2px', margin: 0, padding: 0, listStyle: 'none',
          maxHeight: '142px', overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
        }}>
          {filtered.map((code) => (
            <li
              key={code}
              onMouseDown={() => select(code)}
              style={{
                padding: '6px 10px', fontSize: '13px', cursor: 'pointer',
                fontFamily: 'monospace', letterSpacing: '1px',
                borderBottom: '1px solid var(--rule)',
                color: code === value ? 'var(--primary-dark, #1a6b3c)' : 'var(--ink)',
                background: code === value ? 'var(--primary-faint, #f0f8f4)' : 'white',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary-faint, #f0f8f4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = code === value ? 'var(--primary-faint, #f0f8f4)' : 'white'; }}
            >
              {code}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ListFieldsBlock({ data }) {
  const fields = [
    { label: 'Entradas',             values: data?.inputs },
    { label: 'Salidas',              values: data?.outputs },
    { label: 'Invoca',               values: data?.invokes },
    { label: 'Tablas referenciales', values: data?.reference_tables },
  ];
  return (
    <div className="list-fields-block">
      {fields.map(({ label, values }) => (
        <div key={label} className="list-field">
          <span className="data-field-label">{label}</span>
          <div className="list-pills">
            {values && values.length > 0
              ? values.map((v, i) => <span key={i} className="data-pill">{v}</span>)
              : <span className="pill-empty">N/D</span>}
          </div>
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
  'En revision': 'stamp-violet'
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
  const [validationErrors, setValidationErrors] = useState({});

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
    setValidationErrors({});

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
    setValidationErrors({});
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
    if (!list || list.length === 0) return 'N/D';
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

  const validateEdits = () => {
    const errors = {};
    const requiredFields = [
      { key: 'app', label: 'App' },
      { key: 'type', label: 'Tipo' },
      { key: 'verb', label: 'Verbo' },
      { key: 'scope', label: 'Ámbito' },
    ];
    for (const { key, label } of requiredFields) {
      if (!localEdits[key] || !localEdits[key].trim()) {
        errors[key] = `El campo "${label}" no puede estar vacío`;
      }
    }
    if (!errors.app && localEdits.app && !/^[A-Z]{3}$/.test(localEdits.app.trim())) {
      errors.app = 'El código de app debe tener exactamente 3 letras';
    }
    if (!localEdits.functional_use || !localEdits.functional_use.trim()) {
      errors.functional_use = '__warning__El campo "Uso funcional" está vacío';
    }
    const listFields = [
      { key: 'inputs', label: 'Entradas' },
      { key: 'outputs', label: 'Salidas' },
      { key: 'invokes', label: 'Invoca' },
      { key: 'reference_tables', label: 'Tablas referenciales' },
    ];
    for (const { key, label } of listFields) {
      const list = localEdits[key];
      if (!Array.isArray(list) || list.length === 0) continue;
      const hasEmpty = list.some((item) => !item || !item.trim());
      if (hasEmpty) {
        errors[key] = `"${label}" contiene items vacíos`;
        continue;
      }
      const lower = list.map((s) => s.trim().toLowerCase());
      const seen = new Set();
      const dupes = new Set();
      for (const val of lower) {
        if (seen.has(val)) dupes.add(val);
        seen.add(val);
      }
      if (dupes.size > 0) {
        errors[key] = `"${label}" tiene valores duplicados: "${[...dupes].join('", "')}"`;
      }
    }
    return errors;
  };

  const saveIterationEdits = async (iterationId) => {
    const errors = validateEdits();
    setValidationErrors(errors);
    const blockingErrors = Object.values(errors).filter((e) => e && !e.startsWith('__warning__'));
    if (blockingErrors.length > 0) {
      showToast('❌ Corrige los errores antes de guardar');
      return;
    }
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
      setValidationErrors({});
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
        <div><span className="data-field-label">App</span><span className="mono">{localService.dictionary_data?.app || 'N/D'}</span></div>
        <div><span className="data-field-label">Tipo</span><span className="mono">{localService.dictionary_data?.type || 'N/D'}</span></div>
        <div><span className="data-field-label">Verbo</span><span className="mono">{localService.dictionary_data?.verb || 'N/D'}</span></div>
        <div><span className="data-field-label">Ámbito</span>{localService.dictionary_data?.scope || 'N/D'}</div>
        <div><span className="data-field-label">Fiabilidad</span>{localService.dictionary_data?.reliability || 'N/D'}</div>
        <div><span className="data-field-label">Documento</span>{localService.dictionary_data?.source_document || 'N/D'} <span className="mono">v{localService.dictionary_data?.doc_version || '-'}</span></div>

        <div className="data-field-block">
          <span className="data-field-label">Uso funcional</span>
          {localService.dictionary_data?.functional_use || 'N/D'}
        </div>

        <ListFieldsBlock data={localService.dictionary_data} />
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
        <div><span className="data-field-label">App</span><span className="mono">{finalData?.app || 'N/D'}</span></div>
        <div><span className="data-field-label">Tipo</span><span className="mono">{finalData?.type || 'N/D'}</span></div>
        <div><span className="data-field-label">Verbo</span><span className="mono">{finalData?.verb || 'N/D'}</span></div>
        <div><span className="data-field-label">Ámbito</span>{finalData?.scope || 'N/D'}</div>
        <div><span className="data-field-label">Fiabilidad</span>{finalData?.reliability || 'N/D'}</div>
        <div><span className="data-field-label">Documento</span>{finalData?.source_document || 'N/D'} <span className="mono">v{finalData?.doc_version || '-'}</span></div>

        <div className="data-field-block">
          <span className="data-field-label">Uso funcional</span>
          {finalData?.functional_use || 'N/D'}
        </div>

        <ListFieldsBlock data={finalData} />
      </div>

      <div className="buttons" style={{ marginTop: '20px', justifyContent: 'space-between' }}>
        <button
          className="btn-quiet"
          style={{ flex: 'none' }}
          disabled={resolvingId === 'reset'}
          onClick={resetServiceConflicts}
        >
          {resolvingId === 'reset' ? 'Aplicando...' : 'Reiniciar conflicto'}
        </button>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn-reject"
            disabled={resolvingId === 'reject-service'}
            onClick={rejectService}
          >
            {resolvingId === 'reject-service' ? 'Aplicando...' : 'Rechazar servicio'}
          </button>
          <button
            className="btn-accept"
            disabled={resolvingId === 'accept-close'}
            onClick={requestAcceptPreview}
          >
            {resolvingId === 'accept-close' ? 'Calculando...' : 'Aceptar cambios'}
          </button>
        </div>
      </div>
    </div>
  );

  // Para servicios nuevos: todos los campos editables salvo el documento de origen
  const newServiceResultBox = (() => {
    const inp = (field, enumOptions = null) => {
      const errMsg = validationErrors[field];
      const isWarning = errMsg && errMsg.startsWith('__warning__');
      const hasError = !!errMsg && !isWarning;
      const cls = hasError ? 'input-error' : isWarning ? 'input-warning' : '';
      const onBlur = () => {
        const val = (localEdits[field] || '').trim();
        if (!val) {
          setValidationErrors((prev) => ({ ...prev, [field]: `El campo no puede estar vacío` }));
        } else if (field === 'app' && !/^[A-Z]{3}$/.test(val)) {
          setValidationErrors((prev) => ({ ...prev, [field]: 'El código de app debe tener exactamente 3 letras' }));
        } else {
          setValidationErrors((prev) => ({ ...prev, [field]: null }));
        }
      };
      const setVal = (v) => setLocalEdits((p) => ({ ...p, [field]: v }));
      return (
        <div>
          {field === 'app' ? (
            <AppCodeInput value={localEdits[field] ?? ''} onChange={setVal} onBlur={onBlur} className={cls} />
          ) : enumOptions ? (
            <FixedSelect value={localEdits[field] ?? ''} onChange={setVal} onBlur={onBlur} options={enumOptions} className={cls} />
          ) : (
            <input
              type="text"
              value={localEdits[field] ?? ''}
              onChange={(e) => setVal(e.target.value)}
              onBlur={onBlur}
              className={cls}
              style={FIELD_INPUT_STYLE}
            />
          )}
          {errMsg && (
            <span className={isWarning ? 'field-warning-msg' : 'field-error-msg'}>
              {errMsg.replace('__warning__', '')}
            </span>
          )}
        </div>
      );
    };
    return (
      <div className="data-card">
        <h3>Datos del servicio</h3>

        <div className="data-grid">
          <div><label className="data-field-label">App</label>{inp('app', FIELD_ENUM_OPTIONS.app)}</div>
          <div><label className="data-field-label">Tipo</label>{inp('type', FIELD_ENUM_OPTIONS.type)}</div>
          <div><label className="data-field-label">Verbo</label>{inp('verb', FIELD_ENUM_OPTIONS.verb)}</div>
          <div><label className="data-field-label">Ámbito</label>{inp('scope')}</div>
          <div><span className="data-field-label">Fiabilidad</span>{finalData?.reliability || 'N/D'}</div>
          <div><span className="data-field-label">Documento</span>{finalData?.source_document || 'N/D'} <span className="mono">v{finalData?.doc_version || '-'}</span></div>

          <div className="wide data-field-block">
            <label className="data-field-label">Uso funcional</label>
            <textarea
              rows={3}
              value={localEdits.functional_use ?? ''}
              onChange={(e) => setLocalEdits((p) => ({ ...p, functional_use: e.target.value }))}
              onBlur={() => {
                if (!localEdits.functional_use || !localEdits.functional_use.trim()) {
                  setValidationErrors((prev) => ({ ...prev, functional_use: '__warning__El campo "Uso funcional" está vacío' }));
                } else {
                  setValidationErrors((prev) => ({ ...prev, functional_use: null }));
                }
              }}
              className={
                validationErrors.functional_use
                  ? validationErrors.functional_use.startsWith('__warning__')
                    ? 'input-warning'
                    : 'input-error'
                  : ''
              }
              style={{ width: '100%', padding: '4px 7px', fontSize: '13px', borderRadius: '2px', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }}
            />
            {validationErrors.functional_use && (
              <span className="field-warning-msg">
                {validationErrors.functional_use.replace('__warning__', '')}
              </span>
            )}
          </div>
          <div className="wide" style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '14px', borderTop: '1px solid var(--rule)' }}>
            <ListEditor label="Entradas" items={localEdits.inputs || []} onChange={(v) => setLocalEdits((p) => ({ ...p, inputs: v }))} error={validationErrors.inputs} onBlur={() => setValidationErrors((prev) => ({ ...prev, inputs: null }))} />
            <ListEditor label="Salidas" items={localEdits.outputs || []} onChange={(v) => setLocalEdits((p) => ({ ...p, outputs: v }))} error={validationErrors.outputs} onBlur={() => setValidationErrors((prev) => ({ ...prev, outputs: null }))} />
            <ListEditor label="Invoca" items={localEdits.invokes || []} onChange={(v) => setLocalEdits((p) => ({ ...p, invokes: v }))} error={validationErrors.invokes} onBlur={() => setValidationErrors((prev) => ({ ...prev, invokes: null }))} />
            <ListEditor label="Tablas referenciales" items={localEdits.reference_tables || []} onChange={(v) => setLocalEdits((p) => ({ ...p, reference_tables: v }))} error={validationErrors.reference_tables} onBlur={() => setValidationErrors((prev) => ({ ...prev, reference_tables: null }))} />
          </div>
        </div>

        <div className="buttons" style={{ marginTop: '20px', justifyContent: 'space-between' }}>
          <button
            className="btn-quiet"
            style={{ flex: 'none' }}
            disabled={savingEdits}
            onClick={() => saveIterationEdits(lastIteration.iteration_id)}
          >
            {savingEdits ? 'Guardando...' : 'Guardar estado'}
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn-reject"
              disabled={resolvingId === 'reject-service'}
              onClick={rejectService}
            >
              {resolvingId === 'reject-service' ? 'Aplicando...' : 'Rechazar'}
            </button>
            <button
              className="btn-accept"
              disabled={resolvingId === 'accept-close'}
              onClick={requestAcceptPreview}
            >
              {resolvingId === 'accept-close' ? 'Calculando...' : 'Aceptar'}
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
        <div><span className="data-field-label">App</span><span className="mono">{previousIteration.data?.app || 'N/D'}</span></div>
        <div><span className="data-field-label">Tipo</span><span className="mono">{previousIteration.data?.type || 'N/D'}</span></div>
        <div><span className="data-field-label">Verbo</span><span className="mono">{previousIteration.data?.verb || 'N/D'}</span></div>
        <div><span className="data-field-label">Ámbito</span>{previousIteration.data?.scope || 'N/D'}</div>
        <div><span className="data-field-label">Fiabilidad</span>{previousIteration.data?.reliability || 'N/D'}</div>
        <div><span className="data-field-label">Documento</span>{previousIteration.data?.source_document || 'N/D'} <span className="mono">v{previousIteration.data?.doc_version || '-'}</span></div>
        <div className="data-field-block">
          <span className="data-field-label">Uso funcional</span>
          {previousIteration.data?.functional_use || 'N/D'}
        </div>
        <ListFieldsBlock data={previousIteration.data} />
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
                <div><span className="data-field-label">App</span><span className="mono">{currentIteration.data.app || 'N/D'}</span></div>
                <div><span className="data-field-label">Tipo</span><span className="mono">{currentIteration.data.type || 'N/D'}</span></div>
                <div><span className="data-field-label">Verbo</span><span className="mono">{currentIteration.data.verb || 'N/D'}</span></div>
                <div><span className="data-field-label">Ámbito</span>{currentIteration.data.scope || 'N/D'}</div>
                <div><span className="data-field-label">Fiabilidad</span>{currentIteration.data.reliability || 'N/D'}</div>
                <div><span className="data-field-label">Documento</span>{currentIteration.data.source_document || 'N/D'} <span className="mono">v{currentIteration.data.doc_version || '-'}</span></div>
                <div className="data-field-block">
                  <span className="data-field-label">Uso funcional</span>
                  {currentIteration.data.functional_use || 'N/D'}
                </div>
                <ListFieldsBlock data={currentIteration.data} />
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

                        {conflict.original ? (
                          /* Diff real: hay valor anterior → layout dos columnas */
                          <div className="field-values">
                            <div className="value-box">
                              <div className="label">Valor anterior</div>
                              {isList ? (
                                <div className="list-pills" style={{ marginTop: '4px' }}>
                                  {conflict.original.split(', ').filter(Boolean).map((v, i) => (
                                    <span key={i} className="data-pill" style={{ opacity: 0.7 }}>{v.trim()}</span>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ color: 'var(--text-muted)' }}>{conflict.original}</div>
                              )}
                            </div>
                            <div className="value-box">
                              {isEditable && isList ? (
                                <ListEditor
                                  label="Nueva propuesta"
                                  items={localEdits[conflict.column] || []}
                                  onChange={(v) => setLocalEdits((p) => ({ ...p, [conflict.column]: v }))}
                                  error={validationErrors[conflict.column]}
                                  onBlur={() => setValidationErrors((prev) => ({ ...prev, [conflict.column]: null }))}
                                />
                              ) : <div className="label">Nueva propuesta</div>}
                              {isEditable && !isList && (() => {
                                const col = conflict.column;
                                const enumOpts = FIELD_ENUM_OPTIONS[col];
                                const hasErr = !!validationErrors[col];
                                const cls = hasErr ? 'input-error' : '';
                                const setVal = (v) => setLocalEdits((p) => ({ ...p, [col]: v }));
                                const onBlurConflict = () => {
                                  const val = (localEdits[col] || '').trim();
                                  if (!val) {
                                    setValidationErrors((prev) => ({ ...prev, [col]: 'El campo no puede estar vacío' }));
                                  } else if (col === 'app' && !/^[A-Z]{3}$/.test(val)) {
                                    setValidationErrors((prev) => ({ ...prev, [col]: 'El código de app debe tener exactamente 3 letras' }));
                                  } else {
                                    setValidationErrors((prev) => ({ ...prev, [col]: null }));
                                  }
                                };
                                let control;
                                if (col === 'app') {
                                  control = <AppCodeInput value={localEdits[col] ?? ''} onChange={setVal} onBlur={onBlurConflict} className={cls} />;
                                } else if (enumOpts) {
                                  control = <FixedSelect value={localEdits[col] ?? ''} onChange={setVal} onBlur={onBlurConflict} options={enumOpts} className={cls} />;
                                } else {
                                  control = <input type="text" value={localEdits[col] ?? ''} onChange={(e) => setVal(e.target.value)} onBlur={onBlurConflict} className={cls} style={FIELD_INPUT_STYLE} />;
                                }
                                return (
                                  <>
                                    {control}
                                    {hasErr && <span className="field-error-msg">{validationErrors[col]}</span>}
                                  </>
                                );
                              })()}
                              {!isEditable && (
                                <div style={{ color: 'var(--ink)', fontWeight: 600 }}>
                                  {conflict.proposed}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* Sin valor previo → columna única, sin comparación */
                          <div style={{ paddingTop: '6px' }}>
                            <div className="label" style={{ marginBottom: '8px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              Campo nuevo — sin valor previo en el diccionario
                            </div>
                            {isEditable && isList ? (
                              <ListEditor
                                label="Valor propuesto"
                                items={localEdits[conflict.column] || []}
                                onChange={(v) => setLocalEdits((p) => ({ ...p, [conflict.column]: v }))}
                                error={validationErrors[conflict.column]}
                                onBlur={() => setValidationErrors((prev) => ({ ...prev, [conflict.column]: null }))}
                              />
                            ) : null}
                            {isEditable && !isList && (() => {
                              const col = conflict.column;
                              const enumOpts = FIELD_ENUM_OPTIONS[col];
                              const hasErr = !!validationErrors[col];
                              const cls = hasErr ? 'input-error' : '';
                              const setVal = (v) => setLocalEdits((p) => ({ ...p, [col]: v }));
                              const onBlurConflict = () => {
                                const val = (localEdits[col] || '').trim();
                                if (!val) {
                                  setValidationErrors((prev) => ({ ...prev, [col]: 'El campo no puede estar vacío' }));
                                } else if (col === 'app' && !/^[A-Z]{3}$/.test(val)) {
                                  setValidationErrors((prev) => ({ ...prev, [col]: 'El código de app debe tener exactamente 3 letras' }));
                                } else {
                                  setValidationErrors((prev) => ({ ...prev, [col]: null }));
                                }
                              };
                              let control;
                              if (col === 'app') {
                                control = <AppCodeInput value={localEdits[col] ?? ''} onChange={setVal} onBlur={onBlurConflict} className={cls} />;
                              } else if (enumOpts) {
                                control = <FixedSelect value={localEdits[col] ?? ''} onChange={setVal} onBlur={onBlurConflict} options={enumOpts} className={cls} />;
                              } else {
                                control = <input type="text" value={localEdits[col] ?? ''} onChange={(e) => setVal(e.target.value)} onBlur={onBlurConflict} className={cls} style={FIELD_INPUT_STYLE} />;
                              }
                              return (
                                <>
                                  {control}
                                  {hasErr && <span className="field-error-msg">{validationErrors[col]}</span>}
                                </>
                              );
                            })()}
                            {!isEditable && (
                              <div style={{ color: 'var(--ink)', fontWeight: 600 }}>
                                {conflict.proposed}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}

                <div className="buttons" style={{ justifyContent: 'space-between' }}>
                  <button
                    className="btn-quiet"
                    disabled={savingEdits}
                    onClick={() => saveIterationEdits(currentIteration.iteration_id)}
                    style={{ flex: 'none' }}
                  >
                    {savingEdits ? 'Guardando...' : 'Guardar estado'}
                  </button>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      className="btn-reject"
                      disabled={resolvingId === currentIteration.iteration_id}
                      onClick={() => rejectIterationWithConfirm(currentIteration.iteration_id)}
                    >
                      {resolvingId === currentIteration.iteration_id ? 'Aplicando...' : 'Rechazar cambios'}
                    </button>
                    <button
                      className="btn-unify"
                      disabled={resolvingId === currentIteration.iteration_id}
                      onClick={() => resolveIteration(currentIteration.iteration_id, 'unify')}
                    >
                      {resolvingId === currentIteration.iteration_id ? 'Aplicando...' : 'Unificar'}
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
              <div><span className="data-field-label">App</span><span className="mono">{previewData.app || 'N/D'}</span></div>
              <div><span className="data-field-label">Tipo</span><span className="mono">{previewData.type || 'N/D'}</span></div>
              <div><span className="data-field-label">Verbo</span><span className="mono">{previewData.verb || 'N/D'}</span></div>
              <div><span className="data-field-label">Ámbito</span>{previewData.scope || 'N/D'}</div>
              <div><span className="data-field-label">Fiabilidad</span>{previewData.reliability || 'N/D'}</div>
              <div><span className="data-field-label">Documento</span>{previewData.source_document || 'N/D'} <span className="mono">v{previewData.doc_version || '-'}</span></div>

              <div className="data-field-block">
                <span className="data-field-label">Uso funcional</span>
                {previewData.functional_use || 'N/D'}
              </div>

              <ListFieldsBlock data={previewData} />
            </div>

            <div className="buttons" style={{ marginTop: '24px' }}>
              <button
                className="btn-quiet"
                style={{ flex: 'none' }}
                disabled={resolvingId === 'accept-close'}
                onClick={() => setPreviewData(null)}
              >
                Cancelar
              </button>
              <button
                className="btn-accept"
                disabled={resolvingId === 'accept-close'}
                onClick={confirmAcceptAndClose}
              >
                {resolvingId === 'accept-close' ? 'Aplicando...' : 'Confirmar y cerrar'}
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
              <button
                className="btn-quiet"
                style={{ flex: 'none' }}
                onClick={() => setConfirmDialog(null)}
              >
                Cancelar
              </button>
              <button className="btn-reject" onClick={() => confirmDialog.onConfirm(rejectObservations)}>
                {confirmDialog.confirmLabel || 'Confirmar'}
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
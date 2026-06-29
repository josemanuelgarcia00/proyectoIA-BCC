import React, { useState, useEffect } from 'react';
import { FIELD_ENUM_OPTIONS } from '../domain/enums';
import Toast from './ui/Toast';
import ConfirmDialog from './ui/ConfirmDialog';
import DataCard from './ui/DataCard';
import PillList from './ui/PillList';
import AppCodeInput from './inputs/AppCodeInput';
import FixedSelect from './inputs/FixedSelect';
import ListEditor from './inputs/ListEditor';
import ListFieldsDisplay from './service/ListFieldsDisplay';
import CompareTable from './service/CompareTable';
import useToast from '../hooks/useToast';
import useServiceActions from '../hooks/useServiceActions';

const FIELD_INPUT_STYLE = {
  width: '100%', padding: '4px 7px', fontSize: '13px',
  borderRadius: '2px', fontFamily: 'inherit', boxSizing: 'border-box',
};

const STATUS_STAMP = {
  'Aceptado': 'stamp-moss',
  'Unificado': 'stamp-moss',
  'Cerrado': 'stamp-moss',
  'Desechado': 'stamp-rust',
  'En revision': 'stamp-violet',
};

export default function IterationReview({ service, onServiceClosed }) {
  const [localService, setLocalService] = useState(service);
  const [localEdits, setLocalEdits] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [saveAttempted, setSaveAttempted] = useState(false);
  const { toast, showToast, clearToast } = useToast();

  const {
    resolvingId,
    savingEdits,
    previewData,
    setPreviewData,
    confirmDialog,
    setConfirmDialog,
    resolveIteration,
    revertIteration,
    resetServiceConflicts,
    requestAcceptPreview,
    confirmAcceptAndClose,
    rejectService,
    saveIterationEdits,
    rejectIterationWithConfirm,
  } = useServiceActions({
    localService,
    setLocalService,
    localEdits,
    setValidationErrors,
    setSaveAttempted,
    onServiceClosed,
    showToast,
    serviceKey: service?.service_name,
  });

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
    clearToast();
    setValidationErrors({});
    setSaveAttempted(false);

    // Inicializar localEdits desde el prop directamente: evita el bug de stale
    // dependency cuando dos servicios distintos comparten el mismo currentIterationId
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

  const visibleIterationsEarly = (localService?.perimeter_iterations || []).filter(
    it => it.conflicts && it.conflicts.length > 0
  );
  const currentIterationId = visibleIterationsEarly[0]?.iteration_id ?? null;

  // Inicializar edits cuando la iteración activa cambia
  useEffect(() => {
    setValidationErrors({});
    setSaveAttempted(false);
    const it = visibleIterationsEarly[0];
    if (it) {
      setLocalEdits(dataToEdits(it.data));
    } else {
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

  const resolutionStamp = (resolution) => {
    if (resolution === 'unify') return { label: 'Unificada', cls: 'stamp-moss' };
    if (resolution === 'reject') return { label: 'Rechazada', cls: 'stamp-rust' };
    return { label: 'Revisada', cls: 'stamp-ink' };
  };

  const statusStampClass = STATUS_STAMP[localService.status] || 'stamp-ink';
  const isNewService = !localService.is_in_dictionary;
  const visibleIterations = localService.perimeter_iterations.filter(
    it => it.conflicts && it.conflicts.length > 0
  );
  const allResolved = localService.perimeter_iterations.length > 0 && visibleIterations.length === 0;
  const resolvedIterations = localService.perimeter_iterations.filter(it => it.resolution != null);
  const currentIteration = visibleIterations[0] || null;
  const currentIndex = currentIteration
    ? localService.perimeter_iterations.findIndex(it => it.iteration_id === currentIteration.iteration_id)
    : -1;
  const previousIteration = currentIndex > 0
    ? localService.perimeter_iterations[currentIndex - 1]
    : null;
  const lastIteration = localService.perimeter_iterations.length > 0
    ? localService.perimeter_iterations[localService.perimeter_iterations.length - 1]
    : null;
  const finalData = lastIteration?.data || null;
  const totalConflictIterations = visibleIterations.length + resolvedIterations.length;
  const currentPosition = resolvedIterations.length + 1;

  // ── Bloques de datos ────────────────────────────────────────────────────────

  const dictionaryBox = (
    <DataCard title="Diccionario maestro" accent="primary">
      <div className="data-grid">
        <div><span className="data-field-label">App</span><span className="mono">{localService.dictionary_data?.app || 'N/D'}</span></div>
        <div><span className="data-field-label">Tipo</span><span className="mono">{localService.dictionary_data?.type || 'N/D'}</span></div>
        <div><span className="data-field-label">Verbo</span><span className="mono">{localService.dictionary_data?.verb || 'N/D'}</span></div>
        <div><span className="data-field-label">Ámbito</span>{localService.dictionary_data?.scope || 'N/D'}</div>
        <div><span className="data-field-label">Fiabilidad</span>{localService.dictionary_data?.reliability || 'N/D'}</div>
        <div className="wide"><span className="data-field-label">Documento</span>{localService.dictionary_data?.source_document || 'N/D'} <span className="mono">v{localService.dictionary_data?.doc_version || '-'}</span></div>
        <div className="data-field-block">
          <span className="data-field-label">Uso funcional</span>
          {localService.dictionary_data?.functional_use || 'N/D'}
        </div>
        <ListFieldsDisplay data={localService.dictionary_data} />
      </div>
    </DataCard>
  );

  const finalResultBox = (
    <DataCard
      title="Resultado para el diccionario"
      accent="moss"
      badge={<span className="stamp stamp-moss">Listo para cerrar</span>}
    >
      <div className="data-grid">
        <div><span className="data-field-label">App</span><span className="mono">{finalData?.app || 'N/D'}</span></div>
        <div><span className="data-field-label">Tipo</span><span className="mono">{finalData?.type || 'N/D'}</span></div>
        <div><span className="data-field-label">Verbo</span><span className="mono">{finalData?.verb || 'N/D'}</span></div>
        <div><span className="data-field-label">Ámbito</span>{finalData?.scope || 'N/D'}</div>
        <div><span className="data-field-label">Fiabilidad</span>{finalData?.reliability || 'N/D'}</div>
        <div className="wide"><span className="data-field-label">Documento</span>{finalData?.source_document || 'N/D'} <span className="mono">v{finalData?.doc_version || '-'}</span></div>
        <div className="data-field-block">
          <span className="data-field-label">Uso funcional</span>
          {finalData?.functional_use || 'N/D'}
        </div>
        <ListFieldsDisplay data={finalData} />
      </div>
    </DataCard>
  );

  const previousIterationBox = previousIteration ? (
    <DataCard title="Iteración anterior" accent="primary">
      <div className="data-grid">
        <div><span className="data-field-label">App</span><span className="mono">{previousIteration.data?.app || 'N/D'}</span></div>
        <div><span className="data-field-label">Tipo</span><span className="mono">{previousIteration.data?.type || 'N/D'}</span></div>
        <div><span className="data-field-label">Verbo</span><span className="mono">{previousIteration.data?.verb || 'N/D'}</span></div>
        <div><span className="data-field-label">Ámbito</span>{previousIteration.data?.scope || 'N/D'}</div>
        <div><span className="data-field-label">Fiabilidad</span>{previousIteration.data?.reliability || 'N/D'}</div>
        <div className="wide"><span className="data-field-label">Documento</span>{previousIteration.data?.source_document || 'N/D'} <span className="mono">v{previousIteration.data?.doc_version || '-'}</span></div>
        <div className="data-field-block">
          <span className="data-field-label">Uso funcional</span>
          {previousIteration.data?.functional_use || 'N/D'}
        </div>
        <ListFieldsDisplay data={previousIteration.data} />
      </div>
    </DataCard>
  ) : null;

  const inp = (field, enumOptions = null) => {
    const errMsg = validationErrors[field];
    const isWarning = errMsg && errMsg.startsWith('__warning__');
    const hasError = !!errMsg && !isWarning;
    const cls = hasError ? 'input-error' : isWarning ? 'input-warning' : '';
    const onBlur = () => {
      const val = (localEdits[field] || '').trim();
      if (val && !(field === 'app' && !/^[A-Z]{3}$/.test(val))) {
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
          <input type="text" value={localEdits[field] ?? ''} onChange={(e) => setVal(e.target.value)} onBlur={onBlur} className={cls} style={FIELD_INPUT_STYLE} />
        )}
        {errMsg && (
          <span className={isWarning ? 'field-warning-msg' : 'field-error-msg'}>
            {errMsg.replace('__warning__', '')}
          </span>
        )}
      </div>
    );
  };

  const newServiceResultBox = (
    <DataCard title="Datos del servicio">
      <div className="data-grid">
        <div><label className="data-field-label">App</label>{inp('app', FIELD_ENUM_OPTIONS.app)}</div>
        <div><label className="data-field-label">Tipo</label>{inp('type', FIELD_ENUM_OPTIONS.type)}</div>
        <div><label className="data-field-label">Verbo</label>{inp('verb', FIELD_ENUM_OPTIONS.verb)}</div>
        <div><label className="data-field-label">Ámbito</label>{inp('scope')}</div>
        <div><span className="data-field-label">Fiabilidad</span>{finalData?.reliability || 'N/D'}</div>
        <div className="wide"><span className="data-field-label">Documento</span>{finalData?.source_document || 'N/D'} <span className="mono">v{finalData?.doc_version || '-'}</span></div>
        <div className="wide data-field-block">
          <label className="data-field-label">Uso funcional</label>
          <textarea
            rows={3}
            value={localEdits.functional_use ?? ''}
            onChange={(e) => setLocalEdits((p) => ({ ...p, functional_use: e.target.value }))}
            onBlur={() => {
              if (localEdits.functional_use && localEdits.functional_use.trim()) {
                setValidationErrors((prev) => ({ ...prev, functional_use: null }));
              }
            }}
            className={
              validationErrors.functional_use
                ? validationErrors.functional_use.startsWith('__warning__') ? 'input-warning' : 'input-error'
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
          <ListEditor label="Entradas" items={localEdits.inputs || []} onChange={(v) => setLocalEdits((p) => ({ ...p, inputs: v }))} error={validationErrors.inputs} onBlur={() => setValidationErrors((prev) => ({ ...prev, inputs: null }))} submitted={saveAttempted} />
          <ListEditor label="Salidas" items={localEdits.outputs || []} onChange={(v) => setLocalEdits((p) => ({ ...p, outputs: v }))} error={validationErrors.outputs} onBlur={() => setValidationErrors((prev) => ({ ...prev, outputs: null }))} submitted={saveAttempted} />
          <ListEditor label="Invoca" items={localEdits.invokes || []} onChange={(v) => setLocalEdits((p) => ({ ...p, invokes: v }))} error={validationErrors.invokes} onBlur={() => setValidationErrors((prev) => ({ ...prev, invokes: null }))} submitted={saveAttempted} />
          <ListEditor label="Tablas referenciales" items={localEdits.reference_tables || []} onChange={(v) => setLocalEdits((p) => ({ ...p, reference_tables: v }))} error={validationErrors.reference_tables} onBlur={() => setValidationErrors((prev) => ({ ...prev, reference_tables: null }))} submitted={saveAttempted} />
        </div>
      </div>
      <div className="buttons" style={{ marginTop: '20px', justifyContent: 'space-between' }}>
        <button className="btn-quiet" style={{ flex: 'none' }} disabled={savingEdits} onClick={() => saveIterationEdits(lastIteration.iteration_id)}>
          {savingEdits ? 'Guardando...' : 'Guardar estado'}
        </button>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-reject" disabled={resolvingId === 'reject-service'} onClick={rejectService}>
            {resolvingId === 'reject-service' ? 'Aplicando...' : 'Rechazar'}
          </button>
          <button className="btn-accept" disabled={resolvingId === 'accept-close'} onClick={requestAcceptPreview}>
            {resolvingId === 'accept-close' ? 'Calculando...' : 'Aceptar'}
          </button>
        </div>
      </div>
    </DataCard>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

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
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {dictionaryBox}
                {finalResultBox}
              </div>
              <div className="buttons" style={{ marginTop: '16px', justifyContent: 'space-between' }}>
                <button className="btn-quiet" disabled={resolvingId === 'reset'} onClick={resetServiceConflicts}>
                  {resolvingId === 'reset' ? 'Aplicando...' : 'Reiniciar conflicto'}
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn-reject" disabled={resolvingId === 'reject-service'} onClick={rejectService}>
                    {resolvingId === 'reject-service' ? 'Aplicando...' : 'Rechazar servicio'}
                  </button>
                  <button className="btn-accept" disabled={resolvingId === 'accept-close'} onClick={requestAcceptPreview}>
                    {resolvingId === 'accept-close' ? 'Calculando...' : 'Aceptar cambios'}
                  </button>
                </div>
              </div>
            </>
          )
        ) : (
          <>
            {currentIteration && (
              <div key={currentIteration.iteration_id} className="field-diff">
                <div className="iteration-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Iteración {currentIteration.iteration_id}
                    {isNewService && <span className="stamp stamp-amber">Nuevo</span>}
                  </span>
                  <span className="folio-count">Punto {currentPosition} de {totalConflictIterations}</span>
                </div>

                <CompareTable
                  iterationData={currentIteration.data}
                  dictionaryData={isNewService ? (previousIteration?.data ?? null) : localService.dictionary_data}
                  conflicts={currentIteration.conflicts}
                  localEdits={localEdits}
                  setLocalEdits={setLocalEdits}
                  validationErrors={validationErrors}
                  setValidationErrors={setValidationErrors}
                  hasPrevious={isNewService && !!previousIteration}
                  saveAttempted={saveAttempted}
                />

                <div className="buttons" style={{ marginTop: '16px', justifyContent: 'space-between' }}>
                  <button className="btn-quiet" disabled={savingEdits} onClick={() => saveIterationEdits(currentIteration.iteration_id)} style={{ flex: 'none' }}>
                    {savingEdits ? 'Guardando...' : 'Guardar estado'}
                  </button>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-reject" disabled={resolvingId === currentIteration.iteration_id} onClick={() => rejectIterationWithConfirm(currentIteration.iteration_id)}>
                      {resolvingId === currentIteration.iteration_id ? 'Aplicando...' : 'Rechazar'}
                    </button>
                    <button className="btn-unify" disabled={resolvingId === currentIteration.iteration_id} onClick={() => resolveIteration(currentIteration.iteration_id, 'unify')}>
                      {resolvingId === currentIteration.iteration_id ? 'Aplicando...' : 'Unificar'}
                    </button>
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
                <div key={it.iteration_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'white', border: '1px solid var(--rule)', marginBottom: '8px', fontSize: '13px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="mono">Iteración {it.iteration_id}</span>
                    <span className={`stamp ${stamp.cls}`}>{stamp.label}</span>
                  </span>
                  <button className="btn-quiet" disabled={resolvingId === it.iteration_id} onClick={() => revertIteration(it.iteration_id)}>
                    {resolvingId === it.iteration_id ? 'Aplicando...' : 'Volver atrás'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Modal de preview (resultado del merge antes de confirmar) */}
      {previewData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(21,48,47,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '4px', padding: '32px', maxWidth: '900px', width: '100%', maxHeight: '85vh', overflowY: 'auto', border: '1px solid var(--rule)' }}>
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
              <div className="wide"><span className="data-field-label">Documento</span>{previewData.source_document || 'N/D'} <span className="mono">v{previewData.doc_version || '-'}</span></div>
              <div className="data-field-block">
                <span className="data-field-label">Uso funcional</span>
                {previewData.functional_use || 'N/D'}
              </div>
              <ListFieldsDisplay data={previewData} />
            </div>
            <div className="buttons" style={{ marginTop: '24px' }}>
              <button className="btn-quiet" style={{ flex: 'none' }} disabled={resolvingId === 'accept-close'} onClick={() => setPreviewData(null)}>
                Cancelar
              </button>
              <button className="btn-accept" disabled={resolvingId === 'accept-close'} onClick={confirmAcceptAndClose}>
                {resolvingId === 'accept-close' ? 'Aplicando...' : 'Confirmar y cerrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          withObservations={confirmDialog.withObservations}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      <Toast message={toast} />
    </div>
  );
}

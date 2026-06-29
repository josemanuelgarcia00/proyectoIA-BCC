import { useState, useEffect } from 'react';
import * as servicesApi from '../api/servicesApi';

export default function useServiceActions({
  localService,
  setLocalService,
  localEdits,
  setValidationErrors,
  setSaveAttempted,
  onServiceClosed,
  showToast,
  serviceKey,
}) {
  const [resolvingId, setResolvingId] = useState(null);
  const [savingEdits, setSavingEdits] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  useEffect(() => {
    setPreviewData(null);
  }, [serviceKey]);

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
      if (hasEmpty) { errors[key] = `"${label}" contiene items vacíos`; continue; }
      const lower = list.map((s) => s.trim().toLowerCase());
      const seen = new Set();
      const dupes = new Set();
      for (const val of lower) { if (seen.has(val)) dupes.add(val); seen.add(val); }
      if (dupes.size > 0) errors[key] = `"${label}" tiene valores duplicados: "${[...dupes].join('", "')}"`;
    }
    return errors;
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

  const rejectService = () => {
    setConfirmDialog({
      title: 'Rechazar servicio',
      message: `¿Seguro que quieres rechazar "${localService.service_name}"? No se incorporará al Diccionario.`,
      confirmLabel: 'Rechazar',
      withObservations: true,
      onConfirm: performRejectService,
    });
  };

  const saveIterationEdits = async (iterationId) => {
    const errors = validateEdits();
    setValidationErrors(errors);
    const blockingErrors = Object.values(errors).filter((e) => e && !e.startsWith('__warning__'));
    if (blockingErrors.length > 0) {
      setSaveAttempted(true);
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
      setSaveAttempted(false);
      showToast('✅ Cambios guardados');
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setSavingEdits(false);
    }
  };

  const performRejectIteration = async (iterationId, observations) => {
    setConfirmDialog(null);
    setResolvingId(iterationId);
    try {
      if (observations) {
        await servicesApi.updateIterationObservations(localService.service_name, iterationId, observations);
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

  const rejectIterationWithConfirm = (iterationId) => {
    setConfirmDialog({
      title: 'Rechazar cambios de la iteración',
      message: `¿Seguro que quieres descartar los cambios de la iteración ${iterationId}?`,
      confirmLabel: 'Rechazar cambios',
      withObservations: true,
      onConfirm: (observations) => performRejectIteration(iterationId, observations),
    });
  };

  return {
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
  };
}

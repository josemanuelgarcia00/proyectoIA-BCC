import React, { useState, useEffect } from 'react';
import * as servicesApi from '../api/servicesApi';
import Toast from './ui/Toast';
import ListFieldsDisplay from './service/ListFieldsDisplay';
import useToast from '../hooks/useToast';

export default function RejectedEntry({ service, onRestored }) {
  const [localService, setLocalService] = useState(service);
  const [expandedId, setExpandedId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const { toast, showToast } = useToast();

  useEffect(() => {
    setLocalService(service);
    setExpandedId(null);
  }, [service]);

  if (!localService) {
    return <div className="empty">Selecciona un servicio para ver sus datos.</div>;
  }

  const isWholeServiceRejected = localService.status === 'Desechado';
  const rejectedIterations = isWholeServiceRejected
    ? (localService.perimeter_iterations || [])
    : (localService.perimeter_iterations || []).filter((it) => it.resolution === 'reject');

  const restoreIteration = async (iterationId) => {
    setSavingId(iterationId);
    try {
      const updated = await servicesApi.revertIteration(localService.service_name, iterationId);
      setLocalService(updated);
      showToast(`↩ Iteración ${iterationId} restaurada a revisión`);
      const remaining = (updated.perimeter_iterations || []).filter((it) => it.resolution === 'reject');
      if (remaining.length === 0 && updated.status !== 'Desechado' && onRestored) {
        onRestored(localService.service_name);
      }
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setSavingId(null);
    }
  };

  const restoreWholeService = async () => {
    setSavingId('whole');
    try {
      await servicesApi.revertRejectService(localService.service_name);
      showToast(`↩ ${localService.service_name} movido a revisión`);
      if (onRestored) onRestored(localService.service_name);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="iteration-review">
      <h2 style={{ marginBottom: '16px', color: 'var(--ink)', fontSize: '17px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className="mono">{localService.service_name}</span>
        <span className="stamp stamp-rust">
          {isWholeServiceRejected ? 'Desechado' : 'Iteraciones rechazadas'}
        </span>
      </h2>

      {rejectedIterations.length === 0 ? (
        <div className="empty" style={{ border: '1px solid var(--rule)', borderRadius: '3px', background: 'white' }}>
          No hay iteraciones rechazadas.
        </div>
      ) : (
        <div style={{ marginTop: isWholeServiceRejected ? '0' : '4px' }}>
          {rejectedIterations.map((it) => {
            const isExpanded = expandedId === it.iteration_id;
            return (
              <div key={it.iteration_id} style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '3px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: isExpanded ? '1px solid var(--rule)' : 'none' }}>
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : it.iteration_id)}
                    style={{ display: 'flex', flexDirection: 'column', gap: '4px', cursor: 'pointer', flex: 1 }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="mono" style={{ fontWeight: 600, fontSize: '13px' }}>Iteración {it.iteration_id}</span>
                      <span className="stamp stamp-rust">Rechazada</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {isExpanded ? '▲ Ocultar' : '▼ Ver detalles'}
                      </span>
                    </span>
                    {it.observations && (
                      <div style={{ marginTop: '6px', padding: '7px 10px', background: 'var(--rust-faint, #fdf2f0)', borderLeft: '3px solid var(--rust)', borderRadius: '2px', fontSize: '12.5px', color: 'var(--ink)' }}>
                        <span style={{ fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--rust)', marginRight: '6px' }}>Motivo:</span>
                        {it.observations}
                      </div>
                    )}
                  </div>
                  <button className="btn-quiet" disabled={savingId === it.iteration_id} onClick={() => restoreIteration(it.iteration_id)} style={{ flexShrink: 0, marginLeft: '16px' }}>
                    {savingId === it.iteration_id ? 'Aplicando...' : 'Restaurar a revisión'}
                  </button>
                </div>

                {isExpanded && (
                  <div style={{ padding: '16px' }}>
                    <div className="data-grid" style={{ marginBottom: '16px' }}>
                      <div><span className="data-field-label">App</span><span className="mono">{it.data.app || 'N/D'}</span></div>
                      <div><span className="data-field-label">Tipo</span><span className="mono">{it.data.type || 'N/D'}</span></div>
                      <div><span className="data-field-label">Verbo</span><span className="mono">{it.data.verb || 'N/D'}</span></div>
                      <div><span className="data-field-label">Ámbito</span>{it.data.scope || 'N/D'}</div>
                      <div><span className="data-field-label">Fiabilidad</span>{it.data.reliability || 'N/D'}</div>
                      <div className="wide"><span className="data-field-label">Documento</span>{it.data.source_document || 'N/D'} <span className="mono">v{it.data.doc_version || '-'}</span></div>
                      <div className="data-field-block">
                        <span className="data-field-label">Uso funcional</span>
                        {it.data.functional_use || 'N/D'}
                      </div>
                      <ListFieldsDisplay data={it.data} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Toast message={toast} />
    </div>
  );
}

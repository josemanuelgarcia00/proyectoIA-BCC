import { useState, useEffect } from 'react';
import IterationReview from './components/IterationReview';
import './index.css';

export default function App() {
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('conflicts');
  
  // 1. NUEVO ESTADO: Guardará lo que el usuario escriba en el buscador
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 5000);
  };

  // Pendiente de revisión: tiene conflictos sin resolver, o es un servicio nuevo
  // (no está en el Diccionario) que todavía no se ha aceptado ni rechazado.
  const isPending = (s) => !s.closed && (s.requires_attention || !s.is_in_dictionary);

  const loadConflicts = () => {
    setLoading(true);
    setView('conflicts');
    setSearchTerm(''); // Limpiamos el buscador al cambiar de pestaña

    // Recarga desde el Excel de origen y luego trae el catálogo actualizado
    fetch('/api/v1/services/refresh', { method: 'POST' })
      .catch(() => {})
      .then(() => fetch('/api/v1/services/'))
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        // Pendientes: con conflictos o servicios nuevos aún sin decisión
        const conflicts = data.filter(isPending);
        setServices(conflicts);
        setSelectedService(null);
        setLoading(false);
      })
      .catch(e => {
        console.error('Error cargando conflictos:', e);
        setLoading(false);
      });
  };

  const loadDictionary = () => {
    setLoading(true);
    setView('dictionary');
    setSearchTerm(''); // Limpiamos el buscador al cambiar de pestaña
    
    fetch('/api/v1/services/')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        // Resueltos: ya cerrados o sin nada pendiente de decidir
        const resolved = data.filter(s => !isPending(s));
        setServices(resolved);
        setSelectedService(null);
        setLoading(false);
      })
      .catch(e => {
        console.error('Error cargando diccionario:', e);
        setLoading(false);
      });
  };

  const saveToExcel = () => {
    const confirmed = window.confirm(
      '¿Seguro que quieres sobrescribir el Diccionario final en el Excel? Esta acción no se puede deshacer.'
    );
    if (!confirmed) return;

    setSaving(true);
    fetch('/api/v1/services/save-to-excel', { method: 'POST' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (data.saved) {
          showToast(`💾 Guardado en Excel: ${data.services_written} servicio(s) volcados al Diccionario`);
        } else {
          showToast(`⚠️ Aún quedan ${data.pending_services} servicio(s) con conflictos sin revisar`);
        }
      })
      .catch(e => showToast(`❌ Error al guardar: ${e.message}`))
      .finally(() => setSaving(false));
  };

  useEffect(() => {
    loadConflicts();
  }, []);

  // 2. LÓGICA DE FILTRADO: Comparamos el nombre del servicio con el término de búsqueda
  const filteredServices = services.filter(service => 
    service.service_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container">
      <header>
        <h1>🔧 Gestor de Conflictos de Servicios</h1>
        <p>Resuelve conflictos entre iteraciones de datos del perímetro</p>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button className="btn-header" onClick={loadConflicts}>
            🔄 Recargar Conflictos
          </button>
          <button className="btn-header" onClick={loadDictionary}>
            📚 Ver Diccionario Resuelto
          </button>
          <button className="btn-header" onClick={saveToExcel} disabled={saving}>
            {saving ? '⏳ Guardando...' : '🗂️ Sobrescribir Diccionario Final'}
          </button>
        </div>
      </header>

      <div className="panel">
        {loading ? (
          <div className="loading">⏳ Cargando {view === 'conflicts' ? 'pendientes' : 'diccionario'}...</div>
        ) : services.length === 0 ? (
          <div className="empty">✨ {view === 'conflicts' ? 'No hay nada pendiente de revisión' : 'Diccionario vacío'}</div>
        ) : (
          <>
            <h2>
              {view === 'conflicts' ? '⚠️ Pendientes de Revisión' : '📚 Diccionario'}
              <span style={{ fontSize: '14px', color: 'var(--text-light)', marginLeft: '8px' }}>
                ({filteredServices.length} de {services.length})
              </span>
            </h2>

            {/* 3. INTERFAZ DEL BUSCADOR */}
            <div style={{ marginBottom: '16px' }}>
              <input 
                type="text" 
                placeholder="🔍 Buscar servicio por nombre..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.3s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* 4. RENDERIZADO DE LA LISTA FILTRADA */}
            {filteredServices.length === 0 ? (
              <div className="empty" style={{ padding: '40px 20px' }}>
                No se encontraron servicios que coincidan con "<strong>{searchTerm}</strong>"
              </div>
            ) : (
              filteredServices.map(service => (
                <div
                  key={service.service_name}
                  className={`service-item ${selectedService?.service_name === service.service_name ? 'active' : ''}`}
                  onClick={() => setSelectedService(service)}
                >
                  <div className="service-name">{service.service_name}</div>
                  <div style={{ fontSize: '12px', color: view === 'conflicts' ? 'inherit' : '#555', marginTop: '4px' }}>
                    {service.is_in_dictionary && <span className="badge badge-dict">📚 En diccionario</span>}
                    {!service.is_in_dictionary && <span className="badge" style={{ background: '#fff3cd', color: '#856404' }}>🆕 Nuevo</span>}
                    {service.perimeter_iterations?.length > 0 && (
                      <span style={{ marginLeft: '6px', fontSize: '11px', opacity: 0.7 }}>
                        • {service.perimeter_iterations.length} iteraciones
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      <div className="panel">
        {selectedService ? (
          <IterationReview
            service={selectedService}
            onServiceClosed={(name) => {
              setServices(prev => prev.filter(s => s.service_name !== name));
              setSelectedService(null);
            }}
          />
        ) : (
          <div className="empty">👈 Selecciona un servicio para revisar {view === 'conflicts' ? 'iteraciones y conflictos' : 'detalles'}</div>
        )}
      </div>

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: toast.startsWith('❌') ? 'var(--error)' : (toast.startsWith('⚠️') ? 'var(--warning)' : 'var(--primary-dark)'),
          color: 'white',
          padding: '14px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          fontWeight: 600,
          fontSize: '14px',
          zIndex: 1000,
          maxWidth: '360px'
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
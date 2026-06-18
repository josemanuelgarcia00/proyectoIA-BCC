import { useState, useEffect } from 'react';
import IterationReview from './components/IterationReview';
import DictionaryEntry from './components/DictionaryEntry';
import './index.css';

export default function App() {
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('conflicts');

  // Guarda lo que el usuario escriba en el buscador
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
        // Diccionario completo: servicios que ya forman parte del Diccionario final
        const inDictionary = data.filter(s => s.is_in_dictionary);
        setServices(inDictionary);
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
          showToast(`✅ Guardado en Excel: ${data.services_written} servicio(s) volcados al Diccionario`);
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

  // Filtra por nombre de servicio según el término de búsqueda
  const filteredServices = services.filter(service =>
    service.service_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container">
      <header>
        <span className="eyebrow">Cajamar · Registro de servicios</span>
        <h1>Gestor de Conflictos de Servicios</h1>
        <p>Concilia el Perímetro frente al Diccionario y resuelve cada conflicto sin perder datos</p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button className="btn-header" onClick={loadConflicts}>
            Revisar servicios
          </button>
          <button className="btn-header" onClick={loadDictionary}>
            Ver diccionario completo
          </button>
          <button className="btn-header" onClick={saveToExcel} disabled={saving}>
            {saving ? 'Guardando...' : 'Sobrescribir diccionario final'}
          </button>
        </div>
      </header>

      <div className="panel">
        {loading ? (
          <div className="loading">Cargando {view === 'conflicts' ? 'pendientes' : 'diccionario'}...</div>
        ) : services.length === 0 ? (
          <div className="empty">{view === 'conflicts' ? 'No hay nada pendiente de revisión' : 'El Diccionario todavía no tiene servicios'}</div>
        ) : (
          <>
            <h2>
              {view === 'conflicts' ? 'Pendientes de revisión' : 'Diccionario completo'}
              <span className="mono" style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                {filteredServices.length} de {services.length}
              </span>
            </h2>

            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                className="search-input"
                placeholder="Buscar servicio por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

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
                  <div style={{ fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {service.is_in_dictionary
                      ? <span className="stamp stamp-moss">En diccionario</span>
                      : <span className="stamp stamp-amber">Nuevo</span>}
                    {service.perimeter_iterations?.length > 0 && (
                      <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {service.perimeter_iterations.length} iteraciones
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
          view === 'dictionary' ? (
            <DictionaryEntry service={selectedService} />
          ) : (
            <IterationReview
              service={selectedService}
              onServiceClosed={(name) => {
                setServices(prev => prev.filter(s => s.service_name !== name));
                setSelectedService(null);
              }}
            />
          )
        ) : (
          <div className="empty">Selecciona un servicio para {view === 'conflicts' ? 'revisar iteraciones y conflictos' : 'ver sus datos'}</div>
        )}
      </div>

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: toast.startsWith('❌') ? 'var(--rust)' : (toast.startsWith('⚠️') ? 'var(--amber-ink)' : 'var(--ink)'),
          color: 'white',
          padding: '13px 18px',
          borderRadius: '2px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
          fontWeight: 500,
          fontSize: '13.5px',
          zIndex: 1000,
          maxWidth: '360px'
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
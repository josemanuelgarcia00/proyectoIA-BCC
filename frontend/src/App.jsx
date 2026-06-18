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
  const [sortAlpha, setSortAlpha] = useState(false);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 5000);
  };

  // Pendiente de revisión: tiene conflictos sin resolver, es un servicio nuevo
  // (no está en el Diccionario), o ya se resolvieron todas sus iteraciones pero
  // todavía no se ha aceptado ni rechazado (sigue sin estar "closed"). Este último
  // caso es importante: al resolver el último conflicto, requires_attention pasa
  // a false, pero el servicio debe seguir visible hasta que el usuario confirme.
  const hasResolvedIterations = (s) => (s.perimeter_iterations || []).some(it => it.resolution != null);
  const isPending = (s) => !s.closed && (s.requires_attention || !s.is_in_dictionary || hasResolvedIterations(s));

  const loadConflicts = () => {
    setLoading(true);
    setView('conflicts');
    setSearchTerm(''); // Limpiamos el buscador al cambiar de pestaña
    setSortAlpha(false);
    setSelectedService(null); // Evita renderizar el detalle anterior con la vista nueva mientras carga

    // Trae el catálogo actual en memoria (sin recargar desde el Excel de origen,
    // para no perder revisiones ya aplicadas que aún no se han guardado)
    fetch('/api/v1/services/')
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
    setSortAlpha(false);
    setSelectedService(null); // Evita renderizar el detalle anterior con la vista nueva mientras carga

    // Trae TODO el contenido de la hoja Diccionario del Excel, no solo los
    // servicios que además aparecen en la hoja Perímetro actual
    fetch('/api/v1/services/dictionary/full')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        setServices(data);
        setSelectedService(null);
        setLoading(false);
      })
      .catch(e => {
        console.error('Error cargando diccionario:', e);
        setLoading(false);
      });
  };

  const saveToExcel = () => {
    setSaving(true);
    fetch('/api/v1/services/save-to-excel', { method: 'POST' })
      .then(async r => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.detail || `HTTP ${r.status}`);
        }
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

  // Filtra por nombre de servicio según el término de búsqueda, y opcionalmente
  // ordena alfabéticamente (solo disponible en el Diccionario completo)
  const filteredServices = services
    .filter(service => service.service_name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => sortAlpha ? a.service_name.localeCompare(b.service_name) : 0);

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

            <div style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
              <input
                type="text"
                className="search-input"
                placeholder="Buscar servicio por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {view === 'dictionary' && (
                <button
                  className="btn-quiet"
                  style={{ flex: 'none' }}
                  onClick={() => setSortAlpha(prev => !prev)}
                >
                  {sortAlpha ? 'Orden original' : 'Ordenar A-Z'}
                </button>
              )}
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
                    {view !== 'dictionary' && service.perimeter_iterations?.length > 0 && (
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
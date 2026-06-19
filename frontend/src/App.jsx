import { useState, useEffect } from 'react';
import IterationReview from './components/IterationReview';
import DictionaryEntry from './components/DictionaryEntry';
import RejectedEntry from './components/RejectedEntry';
import SaveSelector from './components/SaveSelector';
import './index.css';

const VIEW_LABELS = {
  conflicts: { loading: 'pendientes', title: 'Pendientes de revisión', empty: 'No hay nada pendiente de revisión', select: 'revisar iteraciones y conflictos' },
  dictionary: { loading: 'diccionario', title: 'Diccionario completo', empty: 'El Diccionario todavía no tiene servicios', select: 'ver sus datos' },
  rejected: { loading: 'desechados', title: 'Servicios desechados', empty: 'No hay servicios desechados', select: 'ver sus datos y moverlo a revisión' },
  save: { loading: 'catálogo', title: 'Guardar en Excel', empty: 'No hay servicios cargados', select: '' }
};

export default function App() {
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('conflicts');

  // Guarda lo que el usuario escriba en el buscador
  const [searchTerm, setSearchTerm] = useState('');
  const [sortAlpha, setSortAlpha] = useState(false);
  const [toast, setToast] = useState(null);

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

  const loadRejected = () => {
    setLoading(true);
    setView('rejected');
    setSearchTerm(''); // Limpiamos el buscador al cambiar de pestaña
    setSortAlpha(false);
    setSelectedService(null); // Evita renderizar el detalle anterior con la vista nueva mientras carga

    // Trae los servicios marcados como Desechado en esta sesión, para poder
    // inspeccionarlos y, si procede, devolverlos a la zona de revisión
    fetch('/api/v1/services/rejected')
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
        console.error('Error cargando desechados:', e);
        setLoading(false);
      });
  };

  const loadSaveSelection = () => {
    setLoading(true);
    setView('save');
    setSearchTerm('');
    setSortAlpha(false);
    setSelectedService(null);

    // Trae el catálogo completo (todos los estados) para poder elegir qué
    // servicios guardar ya y cuáles dejar pendientes para otra sesión
    fetch('/api/v1/services/')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        setServices(data);
        setLoading(false);
      })
      .catch(e => {
        console.error('Error cargando catálogo para guardar:', e);
        setLoading(false);
      });
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
          <button className="btn-header" onClick={loadRejected}>
            Ver desechados
          </button>
          <button className="btn-header" onClick={loadSaveSelection}>
            Guardar en Excel
          </button>
        </div>
      </header>

      {view === 'save' ? (
        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <SaveSelector
            services={services}
            loading={loading}
            onSaved={(msg) => { showToast(msg); loadSaveSelection(); }}
          />
        </div>
      ) : (
        <>
          <div className="panel">
            {loading ? (
              <div className="loading">Cargando {VIEW_LABELS[view].loading}...</div>
            ) : services.length === 0 ? (
              <div className="empty">{VIEW_LABELS[view].empty}</div>
            ) : (
              <>
                <h2>
                  {VIEW_LABELS[view].title}
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
              ) : view === 'rejected' ? (
                <RejectedEntry
                  service={selectedService}
                  onRestored={(name) => {
                    setServices(prev => prev.filter(s => s.service_name !== name));
                    setSelectedService(null);
                  }}
                />
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
              <div className="empty">Selecciona un servicio para {VIEW_LABELS[view].select}</div>
            )}
          </div>
        </>
      )}

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
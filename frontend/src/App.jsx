import { useEffect, useMemo, useState } from 'react';
import IterationReview from './components/IterationReview';
import DictionaryEntry from './components/DictionaryEntry';
import RejectedEntry from './components/RejectedEntry';
import SaveSelector from './components/SaveSelector';
import SplashScreen from './components/SplashScreen';
import { CatalogProvider, useCatalog } from './contexts/CatalogContext';
import './index.css';

function EmptyDetail({ message }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px', padding: '40px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, letterSpacing: '3.5px', textTransform: 'uppercase', color: 'var(--primary-dark)' }}>
        Cajamar
      </div>
      <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', letterSpacing: '1.8px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
        Registro de servicios
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.7', maxWidth: '260px', textAlign: 'center' }}>
        {message}
      </div>
    </div>
  );
}

// AppInner vive dentro del provider para acceder a hasBooted
function AppInner() {
  const { hasBooted } = useCatalog();
  const [showSplash, setShowSplash] = useState(true);
  return (
    <>
      {showSplash && (
        <SplashScreen
          loadingComplete={hasBooted}
          onFinished={() => setShowSplash(false)}
        />
      )}
      <CatalogView />
    </>
  );
}

function CatalogView() {
  const {
    services, view, loading, selectedService, setSelectedService,
    searchTerm, setSearchTerm, sortAlpha, setSortAlpha, toast, showToast,
    viewLabels, loadConflicts, loadDictionary, loadRejected, loadSaveSelection,
    removeService,
  } = useCatalog();

  useEffect(() => { loadConflicts(); }, []);

  // Filtra por nombre de servicio según el término de búsqueda, y opcionalmente
  // ordena alfabéticamente (solo disponible en el Diccionario completo)
  const [conflictFilter, setConflictFilter] = useState('all');

  useEffect(() => { setConflictFilter('all'); }, [view]);

  const filteredServices = services
    .filter((service) => service.service_name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => (sortAlpha ? a.service_name.localeCompare(b.service_name) : 0));

  const displayedServices = view === 'conflicts' && conflictFilter !== 'all'
    ? filteredServices.filter((s) => {
        if (conflictFilter === 'new')      return !s.is_in_dictionary;
        if (conflictFilter === 'conflict') return s.requires_attention;
        if (conflictFilter === 'clean')    return !s.requires_attention && !s.closed;
        if (conflictFilter === 'resolved') return s.closed;
        return true;
      })
    : filteredServices;

  const stats = useMemo(() => {
    const total = services.length;
    if (view === 'conflicts') {
      return {
        total,
        conConflicto: services.filter(s => s.requires_attention).length,
        resueltos: services.filter(s => s.closed).length,
        sinConflicto: services.filter(s => !s.closed && !s.requires_attention).length,
      };
    }
    if (view === 'save') {
      return {
        total,
        listos: services.filter(s => s.closed && !s.requires_attention).length,
        pendientes: services.filter(s => !s.closed || s.requires_attention).length,
      };
    }
    return { total };
  }, [services, view]);

  return (
    <div className="container">
      <header>
        <div className="header-top">
          <div className="header-left">
            <span className="eyebrow">Cajamar · Registro de servicios</span>
            <h1>Gestor de Conflictos de Servicios</h1>
            <p>Concilia el Perímetro frente al Diccionario y resuelve cada conflicto sin perder datos</p>
          </div>
          {!loading && stats.total > 0 && (
            <div className="header-stats">
              <div className="stat-item">
                <span className="stat-value">{stats.total}</span>
                <span className="stat-label">total</span>
              </div>
              {view === 'conflicts' && (
                <>
                  <div className="stat-divider" />
                  <div className="stat-item">
                    <span className="stat-value stat-value--alert">{stats.conConflicto}</span>
                    <span className="stat-label">con conflictos</span>
                  </div>
                  <div className="stat-divider" />
                  <div className="stat-item">
                    <span className="stat-value stat-value--ok">{stats.resueltos}</span>
                    <span className="stat-label">resueltos</span>
                  </div>
                  <div className="stat-divider" />
                  <div className="stat-item">
                    <span className="stat-value">{stats.sinConflicto}</span>
                    <span className="stat-label">sin conflictos</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="header-nav">
          <button className={`btn-nav${view === 'conflicts' ? ' active' : ''}`} onClick={loadConflicts}>Revisar servicios</button>
          <button className={`btn-nav${view === 'dictionary' ? ' active' : ''}`} onClick={loadDictionary}>Ver diccionario completo</button>
          <button className={`btn-nav${view === 'rejected' ? ' active' : ''}`} onClick={loadRejected}>Ver desechados</button>
          <button className={`btn-nav btn-nav-cta${view === 'save' ? ' active' : ''}`} onClick={loadSaveSelection}>Guardar servicios</button>
        </div>
      </header>

      {view === 'save' ? (
        <>
          <div className="panel panel-left">
            <div className="panel-content">
              {!loading && stats.total > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <h2 style={{ marginBottom: '16px' }}>Resumen</h2>
                  {[
                    { label: 'Listos para guardar', value: stats.listos, color: 'var(--moss)' },
                    { label: 'Pendientes de revisión', value: stats.pendientes, color: 'var(--text-muted)' },
                    { label: 'Total en catálogo', value: stats.total, color: 'var(--ink)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                      padding: '9px 0', borderBottom: '1px solid var(--rule)',
                    }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{label}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color }}>{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="panel panel-right">
            <div className="panel-right-scroll">
              <SaveSelector
                services={services}
                loading={loading}
                onSaved={(msg) => { showToast(msg); loadSaveSelection(); }}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="panel panel-left">
            <div className="panel-content">
              {loading ? (
                <div className="loading">Cargando {viewLabels.loading}...</div>
              ) : services.length === 0 ? (
                <div className="empty">{viewLabels.empty}</div>
              ) : (
                <>
                  <h2>
                    {viewLabels.title}
                    <span className="mono" style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                      {displayedServices.length} de {services.length}
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
                        onClick={() => setSortAlpha((prev) => !prev)}
                      >
                        {sortAlpha ? 'Orden original' : 'Ordenar A-Z'}
                      </button>
                    )}
                  </div>

                  <div className="service-list">
                    {displayedServices.length === 0 ? (
                      <div className="empty" style={{ padding: '40px 20px' }}>
                        No se encontraron servicios que coincidan con "<strong>{searchTerm}</strong>"
                      </div>
                    ) : (
                      displayedServices.map((service) => (
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
                  </div>
                </>
              )}
            </div>

            {view === 'conflicts' && !loading && services.length > 0 && (
              <nav className="panel-nav">
                <div className="panel-filters">
                  {[
                    { key: 'all',      label: 'Todos',          count: filteredServices.length },
                    { key: 'new',      label: 'Nuevos',         count: filteredServices.filter(s => !s.is_in_dictionary).length },
                    { key: 'conflict', label: 'Con conflictos', count: filteredServices.filter(s => s.requires_attention).length },
                    { key: 'clean',    label: 'Sin conflictos', count: filteredServices.filter(s => !s.requires_attention && !s.closed).length },
                    { key: 'resolved', label: 'Resueltos',      count: filteredServices.filter(s => s.closed).length },
                  ].map(({ key, label, count }) => (
                    <button
                      key={key}
                      className={`btn-filter${conflictFilter === key ? ' active' : ''}`}
                      onClick={() => setConflictFilter(key)}
                    >
                      {label}
                      <span className="filter-count">{count}</span>
                    </button>
                  ))}
                </div>
              </nav>
            )}
          </div>

          <div className="panel panel-right">
            <div className="panel-right-scroll">
              {selectedService ? (
                view === 'dictionary' ? (
                  <DictionaryEntry service={selectedService} />
                ) : view === 'rejected' ? (
                  <RejectedEntry service={selectedService} onRestored={removeService} />
                ) : (
                  <IterationReview service={selectedService} onServiceClosed={removeService} />
                )
              ) : (
                <EmptyDetail message={`Selecciona un servicio para ${viewLabels.select}`} />
              )}
            </div>
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

export default function App() {
  return (
    <CatalogProvider>
      <AppInner />
    </CatalogProvider>
  );
}

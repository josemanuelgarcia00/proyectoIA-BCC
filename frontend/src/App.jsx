import { useState, useEffect } from 'react'
import ConflictResolver from './components/ConflictResolver'
import IterationReview from './components/IterationReview'

export default function App() {
  const [services, setServices] = useState([])
  const [selectedService, setSelectedService] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/services/conflicts')
      .then(r => r.json())
      .then(data => {
        setServices(data)
        setLoading(false)
      })
      .catch(e => {
        console.error(e)
        setLoading(false)
      })
  }, [])

  return (
    <div className="container">
      <header>
        <h1>🔧 Gestor de Conflictos</h1>
        <p>Resuelve conflictos entre iteraciones de servicios</p>
      </header>

      <div className="panel">
        {loading ? (
          <div className="loading">Cargando conflictos...</div>
        ) : services.length === 0 ? (
          <div className="empty">✨ No hay conflictos pendientes</div>
        ) : (
          <>
            <h2>⚠️ Conflictos ({services.length})</h2>
            {services.map(service => (
              <div
                key={service.service_name}
                className={`service-item ${selectedService?.service_name === service.service_name ? 'active' : ''}`}
                onClick={() => setSelectedService(service)}
              >
                <div className="service-name">{service.service_name}</div>
                <span className={`badge ${service.is_in_dictionary ? 'badge-dict' : ''}`}>
                  {service.is_in_dictionary ? '📚 En diccionario' : '🆕 Nuevo'}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="panel">
        {selectedService ? (
          <IterationReview service={selectedService} />
        ) : (
          <div className="empty">Selecciona un servicio para revisar iteraciones</div>
        )}
      </div>
    </div>
  )
}

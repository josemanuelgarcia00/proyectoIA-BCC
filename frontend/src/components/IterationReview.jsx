import { useState, useEffect } from 'react'
import FieldDiff from './FieldDiff'

export default function IterationReview({ service }) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [decisions, setDecisions] = useState({})
  const [iterations, setIterations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!service) return
    setLoading(true)
    setError(null)
    setCurrentIdx(0)
    setDecisions({})
    
    fetch(`/api/v1/services/${service.service_name}/iterations`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        console.log('Iteraciones recibidas:', data)
        setIterations(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(e => {
        console.error('Error:', e)
        setError(e.message)
        setIterations([])
        setLoading(false)
      })
  }, [service])

  if (loading) return <div className="loading">⏳ Cargando iteraciones...</div>
  if (error) return <div className="error">❌ Error: {error}</div>
  if (iterations.length === 0) return <div className="empty">📭 Sin iteraciones</div>

  const current = iterations[currentIdx]
  const isLast = currentIdx === iterations.length - 1
  const totalConflicts = iterations.reduce((sum, it) => sum + (it.conflicts?.length || 0), 0)

  const handleDecision = (decision) => {
    const newDecisions = { ...decisions, [currentIdx]: decision }
    setDecisions(newDecisions)
    if (isLast) {
      console.log('✅ Resolución completada:', newDecisions)
      alert('Conflictos resueltos. Decisiones guardadas.')
    } else {
      setCurrentIdx(currentIdx + 1)
    }
  }

  return (
    <div className="iteration-review">
      <div className="iteration-header">
        🔄 Iteración {current.iteration_id} de {iterations.length}
        <br/>
        <span style={{ fontSize: '12px', opacity: 0.8 }}>
          {current.conflicts?.length || 0} conflicto(s) • {Object.keys(decisions).length}/{iterations.length} resueltas
        </span>
      </div>

      {current.conflicts && current.conflicts.length > 0 ? (
        <>
          {current.conflicts.map((conflict, i) => (
            <FieldDiff key={i} conflict={conflict} />
          ))}
          <div className="buttons">
            <button className="btn-accept" onClick={() => handleDecision('accept')}>
              ✅ Aceptar cambios
            </button>
            <button className="btn-reject" onClick={() => handleDecision('reject')}>
              ❌ Rechazar
            </button>
          </div>
        </>
      ) : (
        <div className="empty">✨ Sin cambios en esta iteración</div>
      )}

      {isLast && Object.keys(decisions).length === iterations.length && (
        <button className="btn-next" style={{ marginTop: '16px' }} onClick={() => window.location.reload()}>
          🎉 Completar y recargar
        </button>
      )}
    </div>
  )
}

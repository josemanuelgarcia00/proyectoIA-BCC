export default function FieldDiff({ conflict }) {
  const formatValue = (val) => {
    if (Array.isArray(val)) return val.join(', ') || '(vacío)'
    if (!val) return '(vacío)'
    return String(val).substring(0, 100)
  }

  return (
    <div className="field-diff">
      <div className="field-name">📝 {conflict.column}</div>
      <div className="field-values">
        <div className="value-box">
          <div className="label">📚 Base (Diccionario)</div>
          <div>{formatValue(conflict.dictionary_base_value)}</div>
        </div>
        <div className="value-box">
          <div className="label">🆕 Propuesta (Perímetro)</div>
          <div>{formatValue(conflict.perimeter_new_proposal)}</div>
        </div>
      </div>
    </div>
  )
}

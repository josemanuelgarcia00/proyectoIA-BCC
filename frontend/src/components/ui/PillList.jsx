import React from 'react';

export default function PillList({ items, emptyLabel = 'N/D' }) {
  if (!items || items.length === 0) {
    return <span className="pill-empty">{emptyLabel}</span>;
  }
  return (
    <div className="list-pills">
      {items.map((v, i) => <span key={i} className="data-pill">{v}</span>)}
    </div>
  );
}

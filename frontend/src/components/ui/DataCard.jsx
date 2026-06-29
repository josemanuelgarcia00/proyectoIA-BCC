import React from 'react';

export default function DataCard({ title, accent, children, badge }) {
  return (
    <div className={`data-card${accent ? ` accent-${accent}` : ''}`}>
      <h3>
        {title}
        {badge && <> {badge}</>}
      </h3>
      {children}
    </div>
  );
}

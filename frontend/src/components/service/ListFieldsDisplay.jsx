import React from 'react';
import PillList from '../ui/PillList';

const FIELDS = [
  { key: 'inputs',           label: 'Entradas' },
  { key: 'outputs',          label: 'Salidas' },
  { key: 'invokes',          label: 'Invoca' },
  { key: 'reference_tables', label: 'Tablas referenciales' },
];

export default function ListFieldsDisplay({ data }) {
  return (
    <div className="list-fields-block">
      {FIELDS.map(({ key, label }) => (
        <div key={key} className="list-field">
          <span className="data-field-label">{label}</span>
          <PillList items={data?.[key]} />
        </div>
      ))}
    </div>
  );
}

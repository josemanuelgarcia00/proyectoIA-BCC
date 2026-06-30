import React from 'react';
import { FIELD_ENUM_OPTIONS } from '../../domain/enums';
import PillList from '../ui/PillList';
import ListEditor from '../inputs/ListEditor';
import FixedSelect from '../inputs/FixedSelect';
import AppCodeInput from '../inputs/AppCodeInput';

const FIELD_INPUT_STYLE = {
  width: '100%', padding: '4px 7px', fontSize: '13px',
  borderRadius: '2px', fontFamily: 'inherit', boxSizing: 'border-box',
};

const ALL_FIELDS = [
  { key: 'app',              label: 'App',                  inputType: 'app'      },
  { key: 'type',             label: 'Tipo',                 inputType: 'enum'     },
  { key: 'verb',             label: 'Verbo',                inputType: 'enum'     },
  { key: 'scope',            label: 'Ámbito',               inputType: 'text'     },
  { key: 'reliability',      label: 'Fiabilidad',           inputType: 'readonly' },
  { key: 'source_document',  label: 'Documento',            inputType: 'readonly' },
  { key: 'functional_use',   label: 'Uso funcional',        inputType: 'textarea' },
  { key: 'inputs',           label: 'Entradas',             inputType: 'list'     },
  { key: 'outputs',          label: 'Salidas',              inputType: 'list'     },
  { key: 'invokes',          label: 'Invoca',               inputType: 'list'     },
  { key: 'reference_tables', label: 'Tablas referenciales', inputType: 'list'     },
];

export default function CompareTable({
  iterationData,
  dictionaryData,
  conflicts,
  localEdits,
  setLocalEdits,
  validationErrors,
  setValidationErrors,
  hasPrevious,
  saveAttempted,
}) {
  const conflictKeys = new Set((conflicts || []).map(c =>
    (c.column === 'document' || c.column === 'doc_version') ? 'source_document' : c.column
  ));
  const hasLeftCol = !!dictionaryData;

  const renderDisplayValue = (key, data, inputType) => {
    if (!data) return <span className="pill-empty">N/D</span>;
    if (inputType === 'list') {
      return <PillList items={data[key]} />;
    }
    if (key === 'source_document') {
      return <span>{data.source_document || 'N/D'} <span className="mono" style={{ fontSize: '11px' }}>v{data.doc_version || '-'}</span></span>;
    }
    const val = data[key];
    const useMono = inputType === 'app' || inputType === 'enum';
    return <span className={useMono ? 'mono' : ''}>{val || 'N/D'}</span>;
  };

  const renderEditControl = (key, inputType) => {
    const errMsg = validationErrors[key];
    const isWarning = errMsg?.startsWith('__warning__');
    const hasError = !!errMsg && !isWarning;
    const cls = hasError ? 'input-error' : isWarning ? 'input-warning' : '';
    const setVal = (v) => setLocalEdits(p => ({ ...p, [key]: v }));
    const onBlur = () => {
      const val = (localEdits[key] || '').trim();
      if (val && !(key === 'app' && !/^[A-Z]{3}$/.test(val))) {
        setValidationErrors(p => ({ ...p, [key]: null }));
      }
    };

    if (inputType === 'list') {
      return (
        <ListEditor
          label=""
          items={localEdits[key] || []}
          onChange={v => setVal(v)}
          error={validationErrors[key]}
          onBlur={() => setValidationErrors(p => ({ ...p, [key]: null }))}
          submitted={saveAttempted}
        />
      );
    }

    let control;
    if (inputType === 'app') {
      control = <AppCodeInput value={localEdits[key] ?? ''} onChange={setVal} onBlur={onBlur} className={cls} />;
    } else if (inputType === 'enum') {
      control = <FixedSelect value={localEdits[key] ?? ''} onChange={setVal} onBlur={onBlur} options={FIELD_ENUM_OPTIONS[key] || []} className={cls} />;
    } else if (inputType === 'textarea') {
      control = (
        <textarea
          rows={3}
          value={localEdits[key] ?? ''}
          onChange={e => setVal(e.target.value)}
          onBlur={() => { if ((localEdits[key] || '').trim()) setValidationErrors(p => ({ ...p, [key]: null })); }}
          className={cls}
          style={{ ...FIELD_INPUT_STYLE, resize: 'vertical' }}
        />
      );
    } else {
      control = (
        <input type="text" value={localEdits[key] ?? ''} onChange={e => setVal(e.target.value)}
          onBlur={onBlur} className={cls} style={FIELD_INPUT_STYLE} />
      );
    }
    return (
      <>
        {control}
        {errMsg && (
          <span className={isWarning ? 'field-warning-msg' : 'field-error-msg'}>
            {errMsg.replace('__warning__', '')}
          </span>
        )}
      </>
    );
  };

  const leftLabel = hasPrevious ? 'Iteración anterior' : 'Diccionario maestro';

  return (
    <div className={`compare-table${hasLeftCol ? '' : ' compare-table--2col'}`}>
      <div className="compare-header">
        <span className="compare-header-cell">Campo</span>
        {hasLeftCol && <span className="compare-header-cell">{leftLabel}</span>}
        <span className="compare-header-cell">Propuesta del perímetro</span>
      </div>
      {ALL_FIELDS.map(({ key, label, inputType }) => {
        const isDiff = conflictKeys.has(key);
        const isReadonly = inputType === 'readonly';
        const isWide = inputType === 'textarea' || inputType === 'list';
        const rowClass = `compare-row compare-row--${isDiff ? 'diff' : 'equal'}${isWide ? ' compare-row--wide' : ''}`;
        const leftCell = hasLeftCol ? renderDisplayValue(key, dictionaryData, inputType) : null;
        const isEditable = !isReadonly && (isDiff || hasPrevious);
        const rightCell = isEditable
          ? renderEditControl(key, inputType)
          : renderDisplayValue(key, iterationData, inputType);

        if (isWide) {
          return (
            <div key={key} className={rowClass}>
              <span className="compare-col-label">{label}</span>
              {hasLeftCol ? (
                <div className="compare-wide-values">
                  <div>{leftCell}</div>
                  <div>{rightCell}</div>
                </div>
              ) : <div>{rightCell}</div>}
            </div>
          );
        }
        return (
          <div key={key} className={rowClass}>
            <span className="compare-col-label">{label}</span>
            {hasLeftCol && <div>{leftCell}</div>}
            <div>{rightCell}</div>
          </div>
        );
      })}
    </div>
  );
}

export const APP_CODES = [
  'ACG', 'APO', 'ARB', 'ATM', 'AUT', 'AVL', 'BPA', 'BPM', 'BTR', 'BZM',
  'CBC', 'CCA', 'CFM', 'CPA', 'CRM', 'CSA', 'CTL', 'DCR', 'DDB', 'DPL',
  'DSA', 'DTI', 'ERM', 'FIM', 'FWK', 'GAR', 'GIS', 'GRU', 'GUT', 'GXA',
  'IDP', 'IFT', 'INS', 'IPT', 'KRI', 'LGN', 'LIQ', 'LNC', 'LNK', 'LNL',
  'MGR', 'MPM', 'NBR', 'OPB', 'OUA', 'PRC', 'REC', 'REI', 'REM', 'REO',
  'RNT', 'RQC', 'RSI', 'RSK', 'SAC', 'SDB', 'SGA', 'SGT', 'SOC', 'SPI',
  'STR', 'SYS', 'SZR', 'TFO', 'TRC', 'TSG', 'UNP', 'VIN', 'VLT',
];

export const VERB_OPTIONS = [
  { value: 'C', label: 'C – Create (Creación)' },
  { value: 'R', label: 'R – Read (Consulta/Lectura)' },
  { value: 'U', label: 'U – Update (Actualización/Modificación)' },
  { value: 'D', label: 'D – Delete (Eliminación)' },
  { value: 'M', label: 'M – Management (Gestión)' },
  { value: 'V', label: 'V – Validation (Validación)' },
  { value: 'P', label: 'P – Convivencia con procedimiento almacenado' },
  { value: 'T', label: 'T – Convivencia con transacción tuxedo' },
];

export const TYPE_OPTIONS = [
  { value: 'AS', label: 'AS – Servicio atómico' },
  { value: 'BS', label: 'BS – Business service' },
  { value: 'BF', label: 'BF – Función de negocio' },
  { value: 'BR', label: 'BR – Regla de negocio' },
  { value: 'BT', label: 'BT – Batch' },
  { value: 'FD', label: 'FD – Descriptor de fichero' },
  { value: 'RU', label: 'RU – Referencial' },
];

export const FIELD_ENUM_OPTIONS = {
  app: APP_CODES,
  verb: VERB_OPTIONS,
  type: TYPE_OPTIONS,
};

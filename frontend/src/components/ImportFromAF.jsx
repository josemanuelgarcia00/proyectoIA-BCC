import { useRef, useState } from 'react';
import { extractServicesFromArrayBuffer } from '../services/geminiService';
import { fetchDocxFromDrive } from '../services/driveService';
import { openDriveFilePicker, downloadWithToken } from '../services/drivePickerService';
import { parseTSV } from '../services/tsvParser';
import { appendRows } from '../google/sheetsApi';
import { DICTIONARY_COLUMNS, rowFromData } from '../storage/sheetRowFormat';

function serviceToSheetRow(service) {
  const row = rowFromData(service.name, service.data);
  return DICTIONARY_COLUMNS.map((col) => row[col] ?? '');
}

const STEPS = [
  'Selecciona el documento .docx desde tu equipo o comparte el enlace de Google Drive.',
  'Gemini detecta los servicios: CAPA 1 desde las tablas INPUT/OUTPUT, CAPA 2 desde la narrativa en negrita.',
  'Revisa la tabla de servicios detectados y elimina los que no correspondan.',
  'Confirma para añadir las filas al final del Perímetro sin borrar el contenido existente.',
];

const SCOPE_STAMP = {
  'Nuevo': 'stamp-amber',
  'Existente (estructural)': 'stamp-primary',
  'Parametrizacion': 'stamp-violet',
};

export default function ImportFromAF({ onDone }) {
  const [source, setSource]     = useState('local');
  const [status, setStatus]     = useState('idle');   // idle | loading | preview | saving | done
  const [services, setServices] = useState([]);
  const [error, setError]       = useState('');
  const [fileName, setFileName] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [addedCount, setAddedCount] = useState(0);
  const inputRef = useRef(null);

  async function processArrayBuffer(arrayBuffer, name) {
    setFileName(name);
    setError('');
    setStatus('loading');
    try {
      const tsv    = await extractServicesFromArrayBuffer(arrayBuffer);
      const parsed = parseTSV(tsv);
      if (parsed.length === 0) {
        setError('Gemini no detectó servicios. Verifica que el AF contiene las secciones "Relacion de componentes activos" y/o "Relacion de funciones de la aplicacion".');
        setStatus('idle');
        return;
      }
      setServices(parsed);
      setStatus('preview');
    } catch (err) {
      setError(err.message || 'Error al analizar el documento');
      setStatus('idle');
    }
  }

  async function handleFile(file) {
    if (!file) return;
    if (!file.name.endsWith('.docx')) { setError('Solo se admiten archivos .docx'); return; }
    const arrayBuffer = await file.arrayBuffer();
    await processArrayBuffer(arrayBuffer, file.name);
  }

  async function handleOpenPicker() {
    setError('');
    try {
      const { fileId, name, accessToken } = await openDriveFilePicker();
      setStatus('loading');
      setFileName(name);
      const arrayBuffer = await downloadWithToken(fileId, accessToken);
      await processArrayBuffer(arrayBuffer, name);
    } catch (err) {
      if (err.message !== 'cancelled') {
        setError(err.message || 'Error al abrir Google Drive');
      }
    }
  }

  async function handleDriveImport() {
    if (!driveUrl.trim()) { setError('Pega el enlace de Google Drive antes de continuar.'); return; }
    setError('');
    setStatus('loading');
    setFileName('');
    try {
      const { arrayBuffer, name } = await fetchDocxFromDrive(driveUrl);
      if (!name.endsWith('.docx')) {
        setError('El archivo de Drive no es un .docx. Comparte el enlace de un Análisis Funcional en formato Word.');
        setStatus('idle');
        return;
      }
      await processArrayBuffer(arrayBuffer, name);
    } catch (err) {
      setError(err.message || 'Error al descargar el archivo de Google Drive');
      setStatus('idle');
    }
  }

  async function handleConfirm() {
    setStatus('saving');
    try {
      await appendRows('Perímetro', services.map(serviceToSheetRow));
      setAddedCount(services.length);
      setStatus('done');
    } catch (err) {
      setError(err.message || 'Error al guardar en el Perímetro');
      setStatus('preview');
    }
  }

  const countNew        = services.filter(s => s.data.scope === 'Nuevo').length;
  const countExisting   = services.length - countNew;
  const pickerConfigured = !!(import.meta.env.VITE_GOOGLE_CLIENT_ID && import.meta.env.VITE_GOOGLE_API_KEY);

  // ── Panel izquierdo ────────────────────────────────────────────────────────
  function renderLeft() {
    if (status === 'done') {
      return (
        <>
          <h2>Importación completada</h2>
          <div className="info-line" style={{ borderLeftColor: 'var(--moss)', background: 'var(--moss-light)', color: 'var(--moss)' }}>
            {addedCount} {addedCount === 1 ? 'servicio añadido' : 'servicios añadidos'} al Perímetro
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '16px', lineHeight: '1.7' }}>
            Los servicios ya están en la vista de revisión. Los que coincidan con el Diccionario mostrarán sus conflictos automáticamente.
          </p>
        </>
      );
    }

    if (status === 'preview') {
      return (
        <>
          <h2>Servicios detectados</h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[
              { label: 'Total', value: services.length, color: 'var(--ink)' },
              { label: 'Nuevos · Capa 1', value: countNew, color: 'var(--moss)' },
              { label: 'Estructurales · Capa 2', value: countExisting, color: 'var(--amber-ink)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                padding: '9px 0', borderBottom: '1px solid var(--rule)',
              }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color }}>{value}</span>
              </div>
            ))}
          </div>

          {fileName && (
            <div style={{ marginTop: '20px' }}>
              <span className="data-field-label">Documento</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: 'var(--ink)', display: 'block', marginTop: '4px', wordBreak: 'break-all', lineHeight: '1.5' }}>
                {fileName}
              </span>
            </div>
          )}

          <div className="info-line" style={{ marginTop: '24px' }}>
            Puedes eliminar filas antes de confirmar. Los detalles completos (entradas, salidas, invocaciones) estarán disponibles en la vista de revisión.
          </div>
        </>
      );
    }

    // idle / loading
    return (
      <>
        <h2>Importar Análisis Funcional</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.7', marginBottom: '22px' }}>
          Gemini analiza el documento y extrae el inventario de servicios de CAPA 1 y CAPA 2 automáticamente.
        </p>
        {STEPS.map((text, i) => (
          <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '14px', alignItems: 'flex-start' }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, lineHeight: 1.5,
              color: 'var(--primary-dark)', background: 'var(--primary-light)',
              borderRadius: '2px', padding: '2px 8px', flex: 'none',
            }}>
              {i + 1}
            </span>
            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: '1.65' }}>{text}</span>
          </div>
        ))}

        {!pickerConfigured && source === 'drive' && (
          <div style={{ marginTop: '8px', borderTop: '1px solid var(--rule)', paddingTop: '18px' }}>
            <span className="data-field-label" style={{ color: 'var(--amber-ink)', marginBottom: '12px', display: 'block' }}>
              Setup del picker de Drive
            </span>
            {[
              { n: 1, text: 'Ve a console.cloud.google.com y selecciona (o crea) el mismo proyecto de Google Cloud que usa tu Apps Script.' },
              { n: 2, text: 'APIs y servicios → Habilitar APIs → busca y activa "Google Picker API" y "Google Drive API".' },
              { n: 3, text: 'Credenciales → Crear credencial → Clave de API. Copia el valor (VITE_GOOGLE_API_KEY).' },
              { n: 4, text: 'Credenciales → Crear credencial → ID de cliente OAuth 2.0. Tipo: Aplicación web. En "Orígenes de JavaScript autorizados" añade http://localhost:5173. Copia el ID (VITE_GOOGLE_CLIENT_ID).' },
              { n: 5, text: <>Añade las dos claves al archivo <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--paper)', padding: '1px 4px' }}>frontend/.env</code> y reinicia el servidor de desarrollo.</> },
            ].map(({ n, text }) => (
              <div key={n} style={{ display: 'flex', gap: '10px', marginBottom: '12px', alignItems: 'flex-start' }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                  color: 'var(--amber-ink)', background: 'var(--amber-light)',
                  borderRadius: '2px', padding: '2px 7px', flex: 'none', lineHeight: 1.6,
                }}>
                  {n}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.65' }}>{text}</span>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  // ── Panel derecho ──────────────────────────────────────────────────────────
  function renderRight() {
    if (status === 'loading') {
      return (
        <div className="loading">
          {fileName
            ? <>Analizando <em>{fileName}</em> con Gemini…</>
            : 'Descargando desde Google Drive…'}
        </div>
      );
    }

    if (status === 'saving') {
      return <div className="loading">Guardando en el Perímetro…</div>;
    }

    if (status === 'done') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: '20px' }}>
          <span className="stamp stamp-moss" style={{ fontSize: '13px', padding: '6px 18px', letterSpacing: '1.5px' }}>
            ✓ Guardado en el Perímetro
          </span>
          <button className="btn-accept" onClick={onDone}>
            Ir a revisión de servicios
          </button>
        </div>
      );
    }

    if (status === 'preview') {
      return (
        <>
          {error && (
            <div className="info-line" style={{ borderLeftColor: 'var(--rust)', background: 'var(--rust-light)', color: 'var(--rust)', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '18px' }}>
            <button className="btn-quiet" onClick={() => { setStatus('idle'); setServices([]); }}>
              Cancelar
            </button>
            <button className="btn-accept" onClick={handleConfirm} disabled={services.length === 0}>
              Añadir {services.length} {services.length === 1 ? 'servicio' : 'servicios'} al Perímetro
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--rule)', borderRadius: '3px', overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: 'var(--paper)', borderBottom: '2px solid var(--rule)' }}>
                {['Servicio', 'App', 'Tipo', 'Verbo', 'Ámbito', 'Fiabilidad', ''].map((h) => (
                  <th key={h} style={{
                    padding: '8px 12px', textAlign: 'left',
                    fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                    letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.map((svc, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--rule)', background: 'white' }}>
                  <td style={{ padding: '9px 12px' }}>
                    <span className="service-name" style={{ fontSize: '12.5px', marginBottom: 0 }}>
                      {svc.name}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                    {svc.data.app || '—'}
                  </td>
                  <td style={{ padding: '9px 12px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {svc.data.type || '—'}
                  </td>
                  <td style={{ padding: '9px 12px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {svc.data.verb || '—'}
                  </td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                    <span className={`stamp ${SCOPE_STAMP[svc.data.scope] ?? 'stamp-ink'}`}>
                      {svc.data.scope || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                    <span className={`stamp ${svc.data.reliability === 'completa' ? 'stamp-moss' : 'stamp-ink'}`}>
                      {svc.data.reliability || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                    <button
                      title="Eliminar fila"
                      onClick={() => setServices(prev => prev.filter((_, i) => i !== idx))}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', fontSize: '18px', lineHeight: 1, padding: '2px 4px',
                        fontWeight: 300,
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );
    }

    // idle
    return (
      <>
        <div className="panel-filters" style={{ marginBottom: '20px' }}>
          <button
            className={`btn-filter${source === 'local' ? ' active' : ''}`}
            onClick={() => { setSource('local'); setError(''); }}
          >
            Archivo local
          </button>
          <button
            className={`btn-filter${source === 'drive' ? ' active' : ''}`}
            onClick={() => { setSource('drive'); setError(''); }}
          >
            Google Drive
          </button>
        </div>

        {error && (
          <div className="info-line" style={{ borderLeftColor: 'var(--rust)', background: 'var(--rust-light)', color: 'var(--rust)', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {source === 'local' ? (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
            style={{
              border: '2px dashed var(--rule-strong)',
              borderRadius: '2px',
              padding: '56px 32px',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'var(--paper)',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-light)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--rule-strong)'; e.currentTarget.style.background = 'var(--paper)'; }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Arrastra aquí el archivo .docx
            </div>
            <div style={{ fontSize: '12px', color: 'var(--rule-strong)', margin: '0 0 16px' }}>— o —</div>
            <button className="btn-quiet" style={{ pointerEvents: 'none' }}>
              Seleccionar archivo
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".docx"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Picker — opción principal */}
            {pickerConfigured ? (
              <div className="data-card accent-primary" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>
                  Se abrirá el selector de archivos de Google Drive. Inicia sesión con tu cuenta de Google si se solicita.
                </p>
                <div>
                  <button className="btn-accept" onClick={handleOpenPicker}>
                    Abrir Google Drive
                  </button>
                </div>
              </div>
            ) : (
              <div className="data-card" style={{ borderLeft: '3px solid var(--amber-ink)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span className="data-field-label" style={{ color: 'var(--amber-ink)' }}>Configuración pendiente</span>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.7', margin: 0 }}>
                  Para abrir Drive directamente necesitas añadir dos claves al archivo <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--paper)', padding: '1px 5px', borderRadius: '2px' }}>frontend/.env</code>:
                </p>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', background: 'var(--paper)', padding: '10px 14px', borderRadius: '2px', lineHeight: '1.9', color: 'var(--ink)' }}>
                  VITE_GOOGLE_CLIENT_ID=<span style={{ color: 'var(--text-muted)' }}>xxx.apps.googleusercontent.com</span><br />
                  VITE_GOOGLE_API_KEY=<span style={{ color: 'var(--text-muted)' }}>AIza...</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.6' }}>
                  Consulta las instrucciones en el panel izquierdo para obtenerlas desde Google Cloud Console. Mientras tanto puedes usar la opción «pega el enlace» que está más abajo.
                </p>
              </div>
            )}

            {/* Separador */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--rule)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                o pega el enlace
              </span>
              <div style={{ flex: 1, height: '1px', background: 'var(--rule)' }} />
            </div>

            {/* URL manual — opción alternativa */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                type="text"
                className="search-input"
                placeholder="https://drive.google.com/file/d/…"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDriveImport()}
              />
              <div>
                <button
                  className="btn-quiet"
                  onClick={handleDriveImport}
                  disabled={!driveUrl.trim()}
                >
                  Usar este enlace
                </button>
              </div>
            </div>

          </div>
        )}
      </>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const rightTitle = {
    idle:    'Seleccionar origen',
    loading: 'Procesando…',
    preview: `${services.length} ${services.length === 1 ? 'servicio' : 'servicios'} detectados`,
    saving:  'Guardando…',
    done:    'Completado',
  }[status];

  return (
    <>
      <div className="panel panel-left">
        <div style={{ padding: '22px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
          {renderLeft()}
        </div>
      </div>

      <div className="panel panel-right">
        <div className="panel-right-scroll">
          <h2>{rightTitle}</h2>
          {renderRight()}
        </div>
      </div>
    </>
  );
}

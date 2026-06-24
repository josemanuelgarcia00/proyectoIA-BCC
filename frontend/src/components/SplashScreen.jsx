import { useEffect, useRef, useState } from 'react';

/**
 * Pantalla de carga inicial con barra ligada a la carga real de datos.
  * @param {boolean} loadingComplete - Indica si la carga de datos ha terminado.
 */
export default function SplashScreen({
  loadingComplete = false,
  onFinished,
  minDisplayMs = 700,
}) {
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [hidden, setHidden] = useState(false);

  const mountedAt = useRef(Date.now());
  const tickRef = useRef(null);
  const finishedRef = useRef(false);

  // Trickle: incrementos decrecientes que se acercan asintóticamente al 90%.
  function tick() {
    setProgress((prev) => {
      if (prev >= 90) return prev;
      const gap = 90 - prev;
      const step = Math.max(0.5, gap * 0.06);
      return Math.min(90, prev + step);
    });
  }

  useEffect(() => {
    tickRef.current = setInterval(tick, 200);
    return () => clearInterval(tickRef.current);
  }, []);

  // Función para completar el splash (llega a 100% y desaparece).
  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;

    clearInterval(tickRef.current);
    setProgress(100);

    // Pausa mínima para que el usuario vea la barra a 100% antes del fundido.
    setTimeout(() => setLeaving(true), 220);
    setTimeout(() => {
      setHidden(true);
      onFinished?.();
    }, 220 + 500); // 220ms en 100% + 500ms de fundido
  }

  useEffect(() => {
    if (!loadingComplete) return;
    const elapsed = Date.now() - mountedAt.current;
    const remaining = Math.max(0, minDisplayMs - elapsed);
    const t = setTimeout(finish, remaining);
    return () => clearTimeout(t);
  }, [loadingComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  if (hidden) return null;

  const pct = Math.round(progress);

  return (
    <div className={`splash ${leaving ? 'splash-leaving' : ''}`}>
      <div className="splash-mark">
        <span className="splash-eyebrow">Cajamar · Registro de servicios</span>
        <h1 className="splash-title">Gestor de Conflictos</h1>
        <div className="splash-bar">
          <div
            className="splash-bar-fill"
            style={{ transform: `scaleX(${progress / 100})` }}
          />
        </div>
        <div className="splash-footer">
          <span className="splash-status">
            {loadingComplete ? 'Listo' : 'Preparando el diccionario…'}
          </span>
          <span className="splash-percent">{pct}%</span>
        </div>
      </div>
    </div>
  );
}

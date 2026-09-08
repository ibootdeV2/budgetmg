import { useEffect, useRef, useState } from "react";

/**
 * Anime une valeur numérique d'un point A à un point B (ex : au changement
 * de mois sur le Dashboard) au lieu de la faire sauter d'un coup sec.
 * C'est ce petit détail qui donne l'impression qu'un dashboard "réagit"
 * plutôt que "se recharge" — sans dépendance externe (juste rAF), donc
 * sans coût de bundle.
 *
 * Respecte prefers-reduced-motion : saute directement à la valeur finale.
 */
export function useAnimatedNumber(target, { duration = 420 } = {}) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef();

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    const to = Number.isFinite(target) ? target : 0;

    if (prefersReducedMotion || from === to) {
      setValue(to);
      fromRef.current = to;
      return;
    }

    const start = performance.now();
    // ease-out-expo : démarre vite, ralentit en douceur — cohérent avec
    // --ease-out utilisé ailleurs dans l'app pour les transitions CSS.
    const ease = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      setValue(from + (to - from) * ease(progress));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return value;
}

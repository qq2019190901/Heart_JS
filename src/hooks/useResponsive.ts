import { useState, useCallback, useEffect } from 'react';

export interface ResponsiveScale {
  cardScale: number;
  fontScale: number;
  tableScale: number;
  spacingScale: number;
  isCompact: boolean;
  isVeryCompact: boolean;
  vw: number;
  vh: number;
  aspectRatio: number;
  /** Minimum dimension (used for clamp bounds) */
  minDim: number;
  /** Larger dimension (wide screens) */
  maxDim: number;
}

/**
 * Computes responsive scales based on viewport dimensions.
 *
 * Strategy:
 * - Small/portrait screens: scale DOWN to fit everything
 * - Large/wide screens: scale UP to fill available space (no tiny cards on 1080p+)
 * - Card size is tied to viewport height (the constraining dimension in landscape)
 */
export function useResponsiveScale(): ResponsiveScale {
  const [dims, setDims] = useState(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return { vw, vh, minDim: Math.min(vw, vh), maxDim: Math.max(vw, vh) };
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        setDims({ vw, vh, minDim: Math.min(vw, vh), maxDim: Math.max(vw, vh) });
      }, 100);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  return useCallback((): ResponsiveScale => {
    const { vw, vh, minDim, maxDim } = dims;
    const aspectRatio = vw / vh;

    // --- Card scale: grows with the smaller dimension ---
    // On wide desktop (1920x1080), vh=1080 -> cards should be big
    // On phone landscape (720x360), minDim=360 -> cards shrink
    // On phone portrait (390x844), minDim=390 -> cards moderate
    let cardScale = 1.0;
    if (aspectRatio < 0.7) {
      // Very narrow portrait phone
      cardScale = Math.max(0.4, Math.min(0.65, vh / 1000));
    } else if (aspectRatio < 1.0) {
      // Tablet portrait / narrow laptop
      cardScale = Math.max(0.55, Math.min(0.8, vh / 900));
    } else if (minDim < 400) {
      // Small phone
      cardScale = 0.5;
    } else if (minDim < 500) {
      cardScale = 0.65;
    } else if (minDim < 600) {
      cardScale = 0.8;
    } else if (minDim < 800) {
      // Typical laptop (768+)
      cardScale = 0.95;
    } else if (minDim < 1000) {
      // Large laptop / 2K
      cardScale = 1.1;
    } else {
      // 4K+
      cardScale = 1.3;
    }

    // --- Font scale: keep readable but grow on big screens ---
    let fontScale = 1.0;
    if (minDim < 400) fontScale = 0.65;
    else if (minDim < 500) fontScale = 0.8;
    else if (minDim < 650) fontScale = 0.9;
    else if (minDim > 1400) fontScale = 1.15;
    else if (minDim > 1000) fontScale = 1.05;

    // --- Table scale: fills available space ---
    // On wide screens, table should be large and centered
    const tableScale = Math.max(cardScale * 0.9, 0.5);

    // --- Spacing scale ---
    const spacingScale = Math.max(cardScale * 0.85, 0.5);

    const isCompact = minDim < 600;
    const isVeryCompact = minDim < 450;

    return {
      cardScale,
      fontScale,
      tableScale,
      spacingScale,
      isCompact,
      isVeryCompact,
      vw,
      vh,
      aspectRatio,
      minDim,
      maxDim,
    };
  }, [dims]);
}

export function useResponsive(): ResponsiveScale {
  const scaler = useResponsiveScale();
  const [scale, setScale] = useState(scaler);

  useEffect(() => {
    setScale(scaler());
    const unsub = () => setScale(scaler());
    window.addEventListener('responsive-resize', unsub);
    return () => window.removeEventListener('responsive-resize', unsub);
  }, [scaler]);

  return scale;
}

function triggerResponsiveUpdate() {
  window.dispatchEvent(new Event('responsive-resize'));
}

export { triggerResponsiveUpdate };

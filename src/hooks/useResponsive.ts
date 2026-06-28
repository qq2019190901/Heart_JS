import { useState, useCallback, useEffect } from 'react';

export interface ResponsiveScale {
  cardScale: number;
  fontScale: number;
  tableScale: number;
  spacingScale: number;
  /** 0 = very compact (small screen), 1 = spacious (large screen) */
  compactFactor: number;
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
/** Get viewport size in CSS pixels, unaffected by OS-level display scaling */
function getCssViewportSize() {
  // visualViewport is not affected by OS zoom/DPI scaling — always CSS pixels
  if (window.visualViewport) {
    return {
      vw: Math.round(window.visualViewport.width),
      vh: Math.round(window.visualViewport.height),
    };
  }
  // Fallback for older browsers
  return {
    vw: window.innerWidth,
    vh: window.innerHeight,
  };
}

export function useResponsiveScale(): ResponsiveScale {
  const [dims, setDims] = useState(() => {
    const { vw, vh } = getCssViewportSize();
    return { vw, vh, minDim: Math.min(vw, vh), maxDim: Math.max(vw, vh) };
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const { vw, vh } = getCssViewportSize();
        setDims({ vw, vh, minDim: Math.min(vw, vh), maxDim: Math.max(vw, vh) });
      }, 100);
    };
    window.addEventListener('resize', handleResize);
    // visualViewport can change independently (e.g. virtual keyboard on mobile)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }
    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
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
    if (minDim < 400) {
      cardScale = 0.5;
    } else if (minDim < 500) {
      cardScale = 0.5 + (minDim - 400) / 100 * (0.65 - 0.5);
    } else if (minDim < 600) {
      cardScale = 0.65 + (minDim - 500) / 100 * (0.8 - 0.65);
    } else if (minDim < 800) {
      cardScale = 0.8 + (minDim - 600) / 200 * (0.95 - 0.8);
    } else if (minDim < 1000) {
      cardScale = 0.95 + (minDim - 800) / 200 * (1.1 - 0.95);
    } else {
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

    // --- Compact factor: linear 0..1 across the full minDim range [300, 1400] ---
    const compactFactor = Math.max(0, Math.min(1, (minDim - 300) / 1100));

    return {
      cardScale,
      fontScale,
      tableScale,
      spacingScale,
      compactFactor,
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

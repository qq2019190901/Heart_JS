import { useState, useCallback, useEffect } from 'react';

export interface ResponsiveScale {
  /** Scale factor for card sizes (1.0 = normal, <1 = smaller) */
  cardScale: number;
  /** Scale factor for font sizes */
  fontScale: number;
  /** Scale factor for table dimensions */
  tableScale: number;
  /** Scale factor for spacing */
  spacingScale: number;
  /** Whether we're in a compact mode */
  isCompact: boolean;
  /** Whether we're in a very compact mode */
  isVeryCompact: boolean;
  /** Viewport width */
  vw: number;
  /** Viewport height */
  vh: number;
  /** Aspect ratio (width/height) */
  aspectRatio: number;
}

/**
 * Computes responsive scales based on viewport dimensions.
 * Cards and table scale down on small screens, fonts stay readable.
 */
export function useResponsiveScale(): ResponsiveScale {
  const [dims, setDims] = useState(() => ({
    vw: window.innerWidth,
    vh: window.innerHeight,
  }));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      // Debounce resize events
      clearTimeout(timer);
      timer = setTimeout(() => setDims({ vw: window.innerWidth, vh: window.innerHeight }), 100);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  return useCallback((): ResponsiveScale => {
    const { vw, vh } = dims;
    const aspectRatio = vw / vh;

    // Base card width target: ~70px at normal, scales with available space
    // We need room for 13 cards in hand with overlap, plus table
    const minDim = Math.min(vw, vh);
    const maxDim = Math.max(vw, vh);

    // Card scale: starts at 1.0 for large screens, scales down on small/compact
    // Portrait phones get more aggressive scaling
    let cardScale = 1.0;
    if (aspectRatio < 0.7) {
      // Very narrow (portrait phone)
      cardScale = Math.max(0.45, Math.min(0.75, vh / 900));
    } else if (aspectRatio < 1.0) {
      // Narrow (tablet portrait)
      cardScale = Math.max(0.6, Math.min(0.85, vh / 800));
    } else if (minDim < 500) {
      // Small desktop/tablet
      cardScale = Math.max(0.65, minDim / 600);
    } else if (minDim < 700) {
      cardScale = Math.max(0.8, minDim / 700);
    } else {
      cardScale = 1.0;
    }

    // Font scale: less aggressive scaling, keep readable
    let fontScale = 1.0;
    if (minDim < 400) fontScale = 0.7;
    else if (minDim < 500) fontScale = 0.8;
    else if (minDim < 650) fontScale = 0.9;

    // Table scale: proportional to card scale but can be slightly larger
    const tableScale = Math.max(cardScale * 0.95, 0.5);

    // Spacing scale
    const spacingScale = Math.max(cardScale * 0.8, 0.5);

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
    };
  }, [dims]);
}

/**
 * Hook that returns a live responsive scale object.
 * Calls the scaler function on mount and re-subscribes to resize.
 */
export function useResponsive(): ResponsiveScale {
  const scaler = useResponsiveScale();
  const [scale, setScale] = useState(scaler);

  useEffect(() => {
    setScale(scaler());
    const unsub = () => setScale(scaler());
    // Listen for resize via a custom event
    window.addEventListener('responsive-resize', unsub);
    return () => window.removeEventListener('responsive-resize', unsub);
  }, [scaler]);

  return scale;
}

/** Trigger responsive recalculation on viewport change */
function triggerResponsiveUpdate() {
  window.dispatchEvent(new Event('responsive-resize'));
}

export { triggerResponsiveUpdate };

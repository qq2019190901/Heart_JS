import { describe, it, expect, afterEach } from 'vitest';
import { computeResponsiveScale, useResponsive } from '../hooks/useResponsive';
import { renderHook, act } from '../__tests__/test-renderer';

/**
 * Regression suite for the responsive scaling layer.
 *
 * The original bug: `getCssViewportSize()` returned only `{ vw, vh }`, so
 * `minDim` was `undefined`. Every `if (minDim < 400)` comparison was therefore
 * false and `cardScale` fell through to the final `else` branch — rendering
 * cards at 1.3x on a 360px phone.
 */
describe('computeResponsiveScale', () => {
  it('scales cards DOWN on a small phone viewport', () => {
    const s = computeResponsiveScale({ vw: 360, vh: 640, minDim: 360, maxDim: 640 });
    expect(s.cardScale).toBe(0.5);
    expect(s.fontScale).toBe(0.65);
  });

  it('scales cards UP on a large desktop viewport', () => {
    const s = computeResponsiveScale({ vw: 1920, vh: 1200, minDim: 1200, maxDim: 1920 });
    expect(s.cardScale).toBe(1.3);
  });

  it('produces an intermediate scale for mid-size viewports', () => {
    const s = computeResponsiveScale({ vw: 900, vh: 700, minDim: 700, maxDim: 900 });
    expect(s.cardScale).toBeGreaterThan(0.5);
    expect(s.cardScale).toBeLessThan(1.3);
  });

  it('uses the smaller axis as minDim in portrait', () => {
    const portrait = computeResponsiveScale({ vw: 400, vh: 900, minDim: 400, maxDim: 900 });
    expect(portrait.cardScale).toBe(0.5);
  });

  it('uses the smaller axis as minDim in landscape', () => {
    const landscape = computeResponsiveScale({ vw: 900, vh: 400, minDim: 400, maxDim: 900 });
    expect(landscape.cardScale).toBe(0.5);
  });

  it('keeps compactFactor inside [0, 1] at the extremes', () => {
    const tiny = computeResponsiveScale({ vw: 200, vh: 200, minDim: 200, maxDim: 200 });
    expect(tiny.compactFactor).toBe(0);

    const huge = computeResponsiveScale({ vw: 4000, vh: 4000, minDim: 4000, maxDim: 4000 });
    expect(huge.compactFactor).toBe(1);
  });

  it('derives tableScale and spacingScale below cardScale', () => {
    const s = computeResponsiveScale({ vw: 1200, vh: 1000, minDim: 1000, maxDim: 1200 });
    expect(s.tableScale).toBeLessThanOrEqual(s.cardScale);
    expect(s.spacingScale).toBeLessThanOrEqual(s.cardScale);
  });

  it('reports aspectRatio as vw/vh', () => {
    const s = computeResponsiveScale({ vw: 800, vh: 400, minDim: 400, maxDim: 800 });
    expect(s.aspectRatio).toBeCloseTo(2);
  });
});

/** Resize jsdom's viewport so the hook reads fresh CSS-pixel dimensions. */
function setViewport(vw: number, vh: number) {
  Object.defineProperty(window, 'innerWidth', { value: vw, writable: true, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: vh, writable: true, configurable: true });
  const vvp = {
    width: vw,
    height: vh,
    addEventListener() {},
    removeEventListener() {},
  };
  Object.defineProperty(window, 'visualViewport', { value: vvp, writable: true, configurable: true });
}

describe('useResponsive', () => {
  const originalVW = window.innerWidth;
  const originalVH = window.innerHeight;

  afterEach(() => {
    setViewport(originalVW, originalVH);
  });

  it('derives minDim and maxDim from the viewport', () => {
    setViewport(800, 600);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.minDim).toBe(600);
    expect(result.current.maxDim).toBe(800);
  });

  it('scales down on a small screen rather than defaulting to the maximum', () => {
    setViewport(360, 640);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.cardScale).toBe(0.5);
  });

  it('never yields NaN scales for any viewport', () => {
    for (const [vw, vh] of [[320, 480], [768, 1024], [2560, 1440]] as const) {
      setViewport(vw, vh);
      const { result } = renderHook(() => useResponsive());
      expect(Number.isFinite(result.current.cardScale)).toBe(true);
      expect(Number.isFinite(result.current.fontScale)).toBe(true);
      expect(Number.isFinite(result.current.compactFactor)).toBe(true);
    }
  });

  it('recomputes when the viewport changes', () => {
    setViewport(360, 640);
    const { result } = renderHook(() => useResponsive());
    const smallScale = result.current.cardScale;

    act(() => {
      setViewport(1920, 1200);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.cardScale).toBeGreaterThan(smallScale);
  });
});

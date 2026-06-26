import { describe, it, expect } from 'vitest';
import { PASS_DIRECTION_CYCLE } from '../../multiplayer/protocol';

describe('PASS_DIRECTION_CYCLE', () => {
  it('has exactly 4 directions', () => {
    expect(PASS_DIRECTION_CYCLE).toHaveLength(4);
  });

  it('cycles: left, across, right, none', () => {
    expect(PASS_DIRECTION_CYCLE[0]).toBe('left');
    expect(PASS_DIRECTION_CYCLE[1]).toBe('across');
    expect(PASS_DIRECTION_CYCLE[2]).toBe('right');
    expect(PASS_DIRECTION_CYCLE[3]).toBe('none');
  });

  it('round 1 = left, round 2 = across, round 3 = right, round 4 = none, round 5 = left', () => {
    expect(PASS_DIRECTION_CYCLE[0]).toBe('left');  // round 1
    expect(PASS_DIRECTION_CYCLE[1]).toBe('across'); // round 2
    expect(PASS_DIRECTION_CYCLE[2]).toBe('right');  // round 3
    expect(PASS_DIRECTION_CYCLE[3]).toBe('none');   // round 4
    expect(PASS_DIRECTION_CYCLE[0]).toBe('left');   // round 5 (cycle repeats)
  });
});

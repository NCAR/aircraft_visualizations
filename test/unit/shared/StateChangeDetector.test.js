import { StateChangeDetector } from '../../../public/modules/shared/StateChangeDetector.js';

// ---------------------------------------------------------------------------
// constructor
// ---------------------------------------------------------------------------

describe('StateChangeDetector constructor', () => {
  test('initializes with provided state', () => {
    const d = new StateChangeDetector({ a: 1, b: 'hello' });
    expect(d.get('a')).toBe(1);
    expect(d.get('b')).toBe('hello');
  });

  test('defaults to empty state when no argument given', () => {
    const d = new StateChangeDetector();
    expect(d.get('anything')).toBeUndefined();
  });

  test('does not share reference with the original object', () => {
    const init = { x: 10 };
    const d = new StateChangeDetector(init);
    init.x = 99;
    expect(d.get('x')).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// hasChanged
// ---------------------------------------------------------------------------

describe('hasChanged', () => {
  test('returns true when value differs from stored', () => {
    const d = new StateChangeDetector({ count: 0 });
    expect(d.hasChanged('count', 1)).toBe(true);
  });

  test('returns false when value matches stored', () => {
    const d = new StateChangeDetector({ count: 5 });
    expect(d.hasChanged('count', 5)).toBe(false);
  });

  test('uses strict equality (reference check for objects)', () => {
    const obj = { id: 1 };
    const d = new StateChangeDetector({ item: obj });
    expect(d.hasChanged('item', obj)).toBe(false);
    expect(d.hasChanged('item', { id: 1 })).toBe(true);
  });

  test('handles null → non-null transitions', () => {
    const d = new StateChangeDetector({ id: null });
    expect(d.hasChanged('id', 42)).toBe(true);
    expect(d.hasChanged('id', null)).toBe(false);
  });

  test('returns true for unknown key (undefined !== value)', () => {
    const d = new StateChangeDetector({});
    expect(d.hasChanged('missing', 'x')).toBe(true);
    expect(d.hasChanged('missing', undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// detectChanges
// ---------------------------------------------------------------------------

describe('detectChanges', () => {
  test('returns change flags for multiple keys', () => {
    const d = new StateChangeDetector({ a: 1, b: 2, c: 3 });
    const result = d.detectChanges({ a: 1, b: 99, c: 3 });
    expect(result).toEqual({ a: false, b: true, c: false });
  });

  test('handles all changed', () => {
    const d = new StateChangeDetector({ x: 'old', y: 'old' });
    expect(d.detectChanges({ x: 'new', y: 'new' })).toEqual({ x: true, y: true });
  });

  test('handles none changed', () => {
    const d = new StateChangeDetector({ x: 1, y: 2 });
    expect(d.detectChanges({ x: 1, y: 2 })).toEqual({ x: false, y: false });
  });

  test('only checks keys provided in newValues', () => {
    const d = new StateChangeDetector({ a: 1, b: 2, c: 3 });
    const result = d.detectChanges({ a: 99 });
    expect(result).toEqual({ a: true });
    expect(result).not.toHaveProperty('b');
    expect(result).not.toHaveProperty('c');
  });
});

// ---------------------------------------------------------------------------
// hasAnyChanged
// ---------------------------------------------------------------------------

describe('hasAnyChanged', () => {
  test('returns true when at least one value changed', () => {
    const d = new StateChangeDetector({ a: 1, b: 2 });
    expect(d.hasAnyChanged({ a: 1, b: 99 })).toBe(true);
  });

  test('returns false when nothing changed', () => {
    const d = new StateChangeDetector({ a: 1, b: 2 });
    expect(d.hasAnyChanged({ a: 1, b: 2 })).toBe(false);
  });

  test('returns true when all changed', () => {
    const d = new StateChangeDetector({ a: 0, b: 0 });
    expect(d.hasAnyChanged({ a: 1, b: 1 })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe('update', () => {
  test('stores new value for key', () => {
    const d = new StateChangeDetector({ x: 1 });
    d.update('x', 42);
    expect(d.get('x')).toBe(42);
  });

  test('after update, hasChanged returns false for same value', () => {
    const d = new StateChangeDetector({ flag: false });
    d.update('flag', true);
    expect(d.hasChanged('flag', true)).toBe(false);
  });

  test('can set keys not in initial state', () => {
    const d = new StateChangeDetector({});
    d.update('newKey', 'hello');
    expect(d.get('newKey')).toBe('hello');
  });
});

// ---------------------------------------------------------------------------
// updateAll
// ---------------------------------------------------------------------------

describe('updateAll', () => {
  test('updates multiple keys at once', () => {
    const d = new StateChangeDetector({ a: 1, b: 2, c: 3 });
    d.updateAll({ a: 10, b: 20 });
    expect(d.get('a')).toBe(10);
    expect(d.get('b')).toBe(20);
    expect(d.get('c')).toBe(3); // untouched
  });

  test('after updateAll, none of updated keys report as changed', () => {
    const d = new StateChangeDetector({ x: 'old', y: 'old' });
    d.updateAll({ x: 'new', y: 'new' });
    expect(d.hasChanged('x', 'new')).toBe(false);
    expect(d.hasChanged('y', 'new')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

describe('get', () => {
  test('returns stored value', () => {
    const d = new StateChangeDetector({ key: 'value' });
    expect(d.get('key')).toBe('value');
  });

  test('returns undefined for unknown key', () => {
    const d = new StateChangeDetector({});
    expect(d.get('nope')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------

describe('reset', () => {
  test('replaces all state with new initial state', () => {
    const d = new StateChangeDetector({ a: 1, b: 2 });
    d.reset({ c: 99 });
    expect(d.get('c')).toBe(99);
    expect(d.get('a')).toBeUndefined();
    expect(d.get('b')).toBeUndefined();
  });

  test('reset with no argument clears all state', () => {
    const d = new StateChangeDetector({ x: 5 });
    d.reset();
    expect(d.get('x')).toBeUndefined();
  });

  test('does not share reference with reset object', () => {
    const init = { n: 1 };
    const d = new StateChangeDetector({ old: true });
    d.reset(init);
    init.n = 99;
    expect(d.get('n')).toBe(1);
  });

  test('after reset, previously changed values now reflect new initial', () => {
    const d = new StateChangeDetector({ flag: true });
    d.reset({ flag: false });
    expect(d.hasChanged('flag', false)).toBe(false);
    expect(d.hasChanged('flag', true)).toBe(true);
  });
});

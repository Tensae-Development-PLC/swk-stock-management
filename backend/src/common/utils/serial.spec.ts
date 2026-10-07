import {
  normalizeSerial,
  findDuplicateSerials,
  serialsMatch,
  assertSerialsMatchQuantity,
} from './serial';

describe('serial utilities', () => {
  it('normalizes serial numbers', () => {
    expect(normalizeSerial(' tl4g-001 ')).toBe('TL4G-001');
  });

  it('detects duplicate scans in the same transaction', () => {
    expect(findDuplicateSerials(['TL4G001', 'TL4G002', 'tl4g001'])).toEqual(['TL4G001']);
  });

  it('compares expected vs scanned serials', () => {
    expect(serialsMatch('TL4G-002', 'tl4g-002')).toBe(true);
    expect(serialsMatch('TL4G-002', 'TL4G-005')).toBe(false);
  });

  it('requires serial count to match declared quantity', () => {
    expect(() => assertSerialsMatchQuantity(['A', 'B'], 3)).toThrow(/Expected 3/);
  });
});

export function normalizeSerial(value: string): string {
  return value.trim().toUpperCase();
}

export function assertSerialsMatchQuantity(serials: string[], quantity: number): void {
  if (serials.length !== quantity) {
    throw new Error(
      `Expected ${quantity} serial number(s) but received ${serials.length}.`,
    );
  }
}

export function findDuplicateSerials(serials: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const serial of serials) {
    const normalized = normalizeSerial(serial);
    if (seen.has(normalized)) {
      duplicates.add(normalized);
    }
    seen.add(normalized);
  }
  return [...duplicates];
}

export function serialsMatch(expected: string, scanned: string): boolean {
  return normalizeSerial(expected) === normalizeSerial(scanned);
}

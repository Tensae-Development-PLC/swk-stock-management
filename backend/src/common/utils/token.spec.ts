import { generateSecureToken, hashToken } from './token';

describe('receiver tokens', () => {
  it('generates unique cryptographically random tokens', () => {
    const a = generateSecureToken();
    const b = generateSecureToken();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it('stores a hash rather than the raw token', () => {
    const token = generateSecureToken();
    const hashed = hashToken(token);
    expect(hashed).not.toEqual(token);
    expect(hashed).toHaveLength(64);
    expect(hashToken(token)).toEqual(hashed);
  });
});

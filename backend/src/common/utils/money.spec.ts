import { unitCost, profit, moneyString, sumMoney } from './money';

describe('money utilities', () => {
  it('calculates unit cost from total cost without floating-point drift', () => {
    expect(moneyString(unitCost(150000, 3))).toBe('50000.00');
    expect(moneyString(unitCost('250000', 5))).toBe('50000.00');
  });

  it('calculates per-unit profit as selling price minus purchase cost', () => {
    expect(moneyString(profit(65000, 50000))).toBe('15000.00');
    expect(moneyString(profit('65000.50', '50000.25'))).toBe('15000.25');
  });

  it('sums monetary values in ETB', () => {
    expect(moneyString(sumMoney([50000, 50000, 50000]))).toBe('150000.00');
  });
});

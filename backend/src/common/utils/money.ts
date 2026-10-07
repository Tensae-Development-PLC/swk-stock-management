import { Decimal } from 'decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = Decimal.Value;

export function money(value: MoneyInput): Decimal {
  return new Decimal(value);
}

export function moneyString(value: MoneyInput): string {
  return money(value).toFixed(2);
}

export function unitCost(totalCost: MoneyInput, quantity: number): Decimal {
  if (quantity <= 0) {
    throw new Error('Quantity must be greater than zero to calculate unit cost.');
  }
  return money(totalCost).div(quantity).toDecimalPlaces(2);
}

export function profit(sellingPrice: MoneyInput, purchasePrice: MoneyInput): Decimal {
  return money(sellingPrice).minus(money(purchasePrice)).toDecimalPlaces(2);
}

export function sumMoney(values: MoneyInput[]): Decimal {
  let total = money(0);
  for (const value of values) {
    total = total.plus(money(value));
  }
  return total.toDecimalPlaces(2);
}

export function assertNonNegativeMoney(value: MoneyInput, field = 'amount'): void {
  if (money(value).isNegative()) {
    throw new Error(`${field} cannot be negative.`);
  }
}

import {
  addMoney,
  compareMoney,
  fromCents,
  isMoney,
  multiplyMoney,
  toCents,
} from './money.util';

describe('money.util', () => {
  describe('isMoney', () => {
    it.each(['0', '55', '55.5', '55.00', '99999999.99', '0.07'])(
      'accepts %s',
      (value) => {
        expect(isMoney(value)).toBe(true);
      },
    );

    it.each(['', '-1', '1.234', 'abc', '100000000', '1,5', ' 5', '5.'])(
      'rejects "%s"',
      (value) => {
        expect(isMoney(value)).toBe(false);
      },
    );

    it('rejects non-string values', () => {
      expect(isMoney(55)).toBe(false);
      expect(isMoney(null)).toBe(false);
    });
  });

  describe('toCents / fromCents', () => {
    it('converts money strings to cents', () => {
      expect(toCents('55')).toBe(5500);
      expect(toCents('55.5')).toBe(5550);
      expect(toCents('0.07')).toBe(7);
      expect(toCents('99999999.99')).toBe(9999999999);
    });

    it('converts cents back to money strings', () => {
      expect(fromCents(5500)).toBe('55.00');
      expect(fromCents(7)).toBe('0.07');
      expect(fromCents(0)).toBe('0.00');
    });

    it('throws on invalid input', () => {
      expect(() => toCents('-1')).toThrow(RangeError);
      expect(() => fromCents(-1)).toThrow(RangeError);
      expect(() => fromCents(1.5)).toThrow(RangeError);
    });
  });

  describe('arithmetic', () => {
    it('adds without floating-point errors', () => {
      expect(addMoney('0.10', '0.20')).toBe('0.30');
    });

    it('multiplies by a whole quantity', () => {
      expect(multiplyMoney('19.99', 3)).toBe('59.97');
      expect(multiplyMoney('19.99', 0)).toBe('0.00');
    });

    it('rejects invalid quantities', () => {
      expect(() => multiplyMoney('1.00', -1)).toThrow(RangeError);
      expect(() => multiplyMoney('1.00', 1.5)).toThrow(RangeError);
    });

    it('compares amounts', () => {
      expect(compareMoney('1.00', '2.00')).toBe(-1);
      expect(compareMoney('2.00', '2')).toBe(0);
      expect(compareMoney('3.00', '2.99')).toBe(1);
    });
  });
});
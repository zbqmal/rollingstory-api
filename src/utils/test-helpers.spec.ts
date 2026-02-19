import { formatTestMessage, greet, isDefined } from './test-helpers';

describe('Test Helpers', () => {
  describe('formatTestMessage', () => {
    it('should format message with ISO timestamp', () => {
      const message = 'Test message';
      const result = formatTestMessage(message);

      expect(result).toContain(message);
      expect(result).toMatch(
        /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/,
      );
    });
  });

  describe('greet', () => {
    it('should return greeting with name', () => {
      expect(greet('World')).toBe(
        'Hello, World! Branch protection test successful.',
      );
    });
  });

  describe('isDefined', () => {
    it('should return true for defined values', () => {
      expect(isDefined('hello')).toBe(true);
      expect(isDefined(123)).toBe(true);
      expect(isDefined(0)).toBe(true);
    });

    it('should return false for null or undefined', () => {
      expect(isDefined(null)).toBe(false);
      expect(isDefined(undefined)).toBe(false);
    });
  });
});

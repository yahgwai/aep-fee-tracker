import { getYesterday, formatDateToString } from "../../../src/utils/date-utils";

describe("Date Utils", () => {
  describe("getYesterday", () => {
    it("should return yesterday's date at start of day in UTC", () => {
      const yesterday = getYesterday();
      
      // Should be exactly one day before today
      const expectedDate = new Date();
      expectedDate.setUTCDate(expectedDate.getUTCDate() - 1);
      expectedDate.setUTCHours(0, 0, 0, 0);
      
      expect(yesterday.toISOString()).toBe(expectedDate.toISOString());
    });

    it("should return date with zero hours, minutes, seconds, milliseconds", () => {
      const yesterday = getYesterday();
      
      expect(yesterday.getUTCHours()).toBe(0);
      expect(yesterday.getUTCMinutes()).toBe(0);
      expect(yesterday.getUTCSeconds()).toBe(0);
      expect(yesterday.getUTCMilliseconds()).toBe(0);
    });

    it("should handle month boundaries correctly", () => {
      // Mock today to be the first day of a month
      const mockToday = new Date("2024-02-01T10:30:00Z");
      jest.useFakeTimers();
      jest.setSystemTime(mockToday);

      const yesterday = getYesterday();
      
      // Should be last day of previous month
      expect(yesterday.toISOString()).toBe("2024-01-31T00:00:00.000Z");

      jest.useRealTimers();
    });

    it("should handle year boundaries correctly", () => {
      // Mock today to be January 1st
      const mockToday = new Date("2024-01-01T10:30:00Z");
      jest.useFakeTimers();
      jest.setSystemTime(mockToday);

      const yesterday = getYesterday();
      
      // Should be December 31st of previous year
      expect(yesterday.toISOString()).toBe("2023-12-31T00:00:00.000Z");

      jest.useRealTimers();
    });
  });

  describe("formatDateToString", () => {
    it("should format date to YYYY-MM-DD string", () => {
      const date = new Date("2024-03-15T14:30:45.123Z");
      const formatted = formatDateToString(date);
      
      expect(formatted).toBe("2024-03-15");
    });

    it("should handle dates with single-digit month and day", () => {
      const date = new Date("2024-01-05T00:00:00Z");
      const formatted = formatDateToString(date);
      
      expect(formatted).toBe("2024-01-05");
    });

    it("should handle leap year dates", () => {
      const date = new Date("2024-02-29T12:00:00Z");
      const formatted = formatDateToString(date);
      
      expect(formatted).toBe("2024-02-29");
    });

    it("should ignore time component", () => {
      const midnight = new Date("2024-06-15T00:00:00Z");
      const noon = new Date("2024-06-15T12:00:00Z");
      const endOfDay = new Date("2024-06-15T23:59:59.999Z");
      
      expect(formatDateToString(midnight)).toBe("2024-06-15");
      expect(formatDateToString(noon)).toBe("2024-06-15");
      expect(formatDateToString(endOfDay)).toBe("2024-06-15");
    });
  });
});
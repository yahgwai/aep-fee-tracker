import { describe, it, expect } from "@jest/globals";
import {
  validateDateFormat,
  isValidCalendarDate,
  validateDateRange,
} from "../../src/date-validation";

describe("date-validation", () => {
  describe("validateDateFormat", () => {
    it("returns true for valid YYYY-MM-DD format", () => {
      expect(validateDateFormat("2024-01-15")).toBe(true);
      expect(validateDateFormat("2023-12-31")).toBe(true);
      expect(validateDateFormat("2025-06-01")).toBe(true);
      expect(validateDateFormat("2020-02-29")).toBe(true);
    });

    it("returns false for invalid date formats", () => {
      expect(validateDateFormat("2024-1-15")).toBe(false);
      expect(validateDateFormat("2024/01/15")).toBe(false);
      expect(validateDateFormat("01-15-2024")).toBe(false);
      expect(validateDateFormat("2024.01.15")).toBe(false);
      expect(validateDateFormat("24-01-15")).toBe(false);
    });

    it("returns true for edge cases in date format", () => {
      expect(validateDateFormat("2024-01-01")).toBe(true);
      expect(validateDateFormat("2024-12-31")).toBe(true);
      expect(validateDateFormat("2024-02-28")).toBe(true);
    });

    it("returns true for potentially invalid calendar dates that match format", () => {
      // These match the format but aren't valid calendar dates
      // Calendar validation will be handled separately
      expect(validateDateFormat("2024-02-30")).toBe(true);
      expect(validateDateFormat("2024-13-01")).toBe(false);
      expect(validateDateFormat("2024-00-15")).toBe(false);
      expect(validateDateFormat("2024-01-32")).toBe(false);
    });
  });

  describe("isValidCalendarDate", () => {
    it("returns true for valid calendar dates", () => {
      expect(isValidCalendarDate("2024-01-15")).toBe(true);
      expect(isValidCalendarDate("2023-12-31")).toBe(true);
      expect(isValidCalendarDate("2020-02-29")).toBe(true); // leap year
    });

    it("returns false for invalid calendar dates", () => {
      expect(isValidCalendarDate("2024-02-30")).toBe(false); // Feb doesn't have 30 days
      expect(isValidCalendarDate("2023-02-29")).toBe(false); // not a leap year
      expect(isValidCalendarDate("2024-04-31")).toBe(false); // April has 30 days
    });

    it("returns false for invalid formats", () => {
      expect(isValidCalendarDate("2024-13-01")).toBe(false); // invalid month
      expect(isValidCalendarDate("2024-1-15")).toBe(false); // wrong format
      expect(isValidCalendarDate("not-a-date")).toBe(false);
    });
  });

  describe("validateDateRange", () => {
    it("returns void when both dates are valid and start <= end", () => {
      expect(() => validateDateRange("2024-01-01", "2024-01-31")).not.toThrow();
      expect(() => validateDateRange("2024-01-15", "2024-01-15")).not.toThrow();
    });

    it("throws error when start date is after end date", () => {
      expect(() => validateDateRange("2024-02-01", "2024-01-31")).toThrow(
        "Start date (2024-02-01) must be before or equal to end date (2024-01-31)",
      );
    });

    it("throws error for invalid start date format", () => {
      expect(() => validateDateRange("2024-1-1", "2024-01-31")).toThrow(
        "Invalid start date format: 2024-1-1. Expected YYYY-MM-DD",
      );
    });

    it("throws error for invalid end date format", () => {
      expect(() => validateDateRange("2024-01-01", "2024/01/31")).toThrow(
        "Invalid end date format: 2024/01/31. Expected YYYY-MM-DD",
      );
    });

    it("throws error for invalid start calendar date", () => {
      expect(() => validateDateRange("2024-02-30", "2024-03-01")).toThrow(
        "Invalid start calendar date: 2024-02-30",
      );
    });

    it("throws error for invalid end calendar date", () => {
      expect(() => validateDateRange("2024-01-01", "2024-02-30")).toThrow(
        "Invalid end calendar date: 2024-02-30",
      );
    });

    it("allows undefined dates", () => {
      expect(() => validateDateRange(undefined, undefined)).not.toThrow();
      expect(() => validateDateRange("2024-01-01", undefined)).not.toThrow();
      expect(() => validateDateRange(undefined, "2024-01-31")).not.toThrow();
    });
  });
});

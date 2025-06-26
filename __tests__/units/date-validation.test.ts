import { describe, it, expect } from "@jest/globals";
import { validateDateFormat } from "../../src/date-validation";

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
});

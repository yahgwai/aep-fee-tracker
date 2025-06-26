import { describe, it, expect } from "@jest/globals";
import { validateDateFormat } from "../../src/date-validation";

describe("date-validation", () => {
  describe("validateDateFormat", () => {
    it("returns true for valid YYYY-MM-DD format", () => {
      expect(validateDateFormat("2024-01-15")).toBe(true);
    });

    it("returns false for invalid date formats", () => {
      expect(validateDateFormat("2024-1-15")).toBe(false);
    });
  });
});

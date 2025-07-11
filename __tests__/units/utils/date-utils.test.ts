import { getYesterday, formatDateToString, getBlock1Date } from "../../../src/utils/date-utils";
import { ethers } from "ethers";

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

  describe("getBlock1Date", () => {
    it("should return the date associated with block 1 at start of day", async () => {
      // Mock provider
      const mockProvider = {
        getBlock: jest.fn(),
      } as unknown as ethers.Provider;

      // Mock block 1 with timestamp for July 11, 2022, 10:30 AM UTC
      const mockBlock1 = {
        timestamp: 1657537800, // July 11, 2022, 10:30:00 UTC
      };
      
      (mockProvider.getBlock as jest.Mock).mockResolvedValue(mockBlock1);

      const block1Date = await getBlock1Date(mockProvider);

      // Should return July 11, 2022 at start of day (00:00:00 UTC)
      expect(block1Date.toISOString()).toBe("2022-07-11T00:00:00.000Z");
      expect(mockProvider.getBlock).toHaveBeenCalledWith(1);
    });

    it("should set time to start of day regardless of block timestamp time", async () => {
      const mockProvider = {
        getBlock: jest.fn(),
      } as unknown as ethers.Provider;

      // Mock block 1 with timestamp for end of day
      const mockBlock1 = {
        timestamp: 1657580399, // July 11, 2022, 23:59:59 UTC
      };
      
      (mockProvider.getBlock as jest.Mock).mockResolvedValue(mockBlock1);

      const block1Date = await getBlock1Date(mockProvider);

      // Should still return start of July 11, 2022
      expect(block1Date.toISOString()).toBe("2022-07-11T00:00:00.000Z");
      expect(block1Date.getUTCHours()).toBe(0);
      expect(block1Date.getUTCMinutes()).toBe(0);
      expect(block1Date.getUTCSeconds()).toBe(0);
      expect(block1Date.getUTCMilliseconds()).toBe(0);
    });

    it("should throw error if block 1 is not found", async () => {
      const mockProvider = {
        getBlock: jest.fn(),
      } as unknown as ethers.Provider;

      (mockProvider.getBlock as jest.Mock).mockResolvedValue(null);

      await expect(getBlock1Date(mockProvider)).rejects.toThrow("Block 1 not found");
      expect(mockProvider.getBlock).toHaveBeenCalledWith(1);
    });
  });
});
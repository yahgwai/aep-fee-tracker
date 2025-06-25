import { ethers } from "ethers";
import { FileManager } from "../../src/file-manager";
import { DailyDistributorDataCollector } from "../../src/daily-distributor-data-collector";
import {
  DistributorType,
  DistributorsData,
  BlockNumberData,
} from "../../src/types";

jest.mock("../../src/file-manager");

// Create a concrete test implementation of the abstract class
interface TestData {
  processed: boolean;
}

class TestDailyDistributorDataCollector extends DailyDistributorDataCollector<TestData> {
  async processDailyData(): Promise<TestData> {
    // Mock implementation for testing
    return { processed: true };
  }

  async finalizeDistributorData(): Promise<void> {
    // Mock implementation for testing
  }

  // Expose protected methods for testing
  public override formatDate(date: Date): string {
    return super.formatDate(date);
  }

  public override findDateForBlock(
    blockNumbersData: BlockNumberData,
    blockNumber: number,
  ): string | null {
    return super.findDateForBlock(blockNumbersData, blockNumber);
  }

  public override convertDateToBlockRange(
    date: string,
    blockNumbersData: BlockNumberData,
  ): { startBlock: number; endBlock: number } {
    return super.convertDateToBlockRange(date, blockNumbersData);
  }
}

describe("DailyDistributorDataCollector", () => {
  let mockFileManager: jest.Mocked<FileManager>;
  let mockProvider: jest.Mocked<ethers.Provider>;

  beforeEach(() => {
    mockFileManager = {
      readDistributors: jest.fn(),
      readBlockNumbers: jest.fn(),
    } as unknown as jest.Mocked<FileManager>;
    mockProvider = {} as jest.Mocked<ethers.Provider>;
  });

  describe("constructor", () => {
    it("can be instantiated with provider and fileManager dependencies", () => {
      const collector = new TestDailyDistributorDataCollector(
        mockProvider,
        mockFileManager,
      );
      expect(collector).toBeDefined();
      expect(collector).toBeInstanceOf(DailyDistributorDataCollector);
    });

    it("stores provider as readonly property", () => {
      const collector = new TestDailyDistributorDataCollector(
        mockProvider,
        mockFileManager,
      );
      expect(collector.provider).toBe(mockProvider);
    });

    it("stores fileManager as readonly property", () => {
      const collector = new TestDailyDistributorDataCollector(
        mockProvider,
        mockFileManager,
      );
      expect(collector.fileManager).toBe(mockFileManager);
    });
  });

  describe("abstract methods", () => {
    it("requires subclasses to implement processDailyData", () => {
      const collector = new TestDailyDistributorDataCollector(
        mockProvider,
        mockFileManager,
      );
      expect(collector.processDailyData).toBeDefined();
      expect(typeof collector.processDailyData).toBe("function");
    });

    it("requires subclasses to implement finalizeDistributorData", () => {
      const collector = new TestDailyDistributorDataCollector(
        mockProvider,
        mockFileManager,
      );
      expect(collector.finalizeDistributorData).toBeDefined();
      expect(typeof collector.finalizeDistributorData).toBe("function");
    });
  });

  describe("processDistributors", () => {
    let collector: TestDailyDistributorDataCollector;

    beforeEach(() => {
      collector = new TestDailyDistributorDataCollector(
        mockProvider,
        mockFileManager,
      );
    });

    it("exists as a method on DailyDistributorDataCollector instance", () => {
      expect(collector.processDistributors).toBeDefined();
      expect(typeof collector.processDistributors).toBe("function");
    });

    it("accepts optional distributorAddress parameter", () => {
      expect(collector.processDistributors.length).toBeLessThanOrEqual(1);
    });

    it("returns a Promise", () => {
      const result = collector.processDistributors();
      expect(result).toBeInstanceOf(Promise);
      result.catch(() => {}); // Prevent unhandled promise rejection
    });

    it("returns Promise<void>", async () => {
      const result = await collector.processDistributors();
      expect(result).toBeUndefined();
    });
  });

  describe("processDistributors - address validation", () => {
    let collector: TestDailyDistributorDataCollector;

    beforeEach(() => {
      mockFileManager = {
        readDistributors: jest.fn().mockReturnValue(undefined),
        readBlockNumbers: jest.fn(),
      } as unknown as jest.Mocked<FileManager>;
      collector = new TestDailyDistributorDataCollector(
        mockProvider,
        mockFileManager,
      );
    });

    it("accepts a valid Ethereum address without throwing", async () => {
      const validAddress = "0x1234567890123456789012345678901234567890";
      await expect(
        collector.processDistributors(validAddress),
      ).resolves.not.toThrow();
    });

    it("throws error for invalid Ethereum address", async () => {
      const invalidAddress = "not-an-address";
      await expect(
        collector.processDistributors(invalidAddress),
      ).rejects.toThrow("Invalid Ethereum address: not-an-address");
    });

    it("throws error for address with invalid checksum", async () => {
      const invalidChecksumAddress =
        "0x1234567890123456789012345678901234567890ABC";
      await expect(
        collector.processDistributors(invalidChecksumAddress),
      ).rejects.toThrow(
        "Invalid Ethereum address: 0x1234567890123456789012345678901234567890ABC",
      );
    });

    it("works without distributorAddress parameter", async () => {
      await expect(collector.processDistributors()).resolves.not.toThrow();
    });

    it("works with undefined distributorAddress", async () => {
      await expect(
        collector.processDistributors(undefined),
      ).resolves.not.toThrow();
    });
  });

  describe("processDistributors - loading distributors", () => {
    let collector: TestDailyDistributorDataCollector;

    beforeEach(() => {
      mockFileManager = {
        readDistributors: jest.fn(),
        readBlockNumbers: jest.fn(),
      } as unknown as jest.Mocked<FileManager>;
      collector = new TestDailyDistributorDataCollector(
        mockProvider,
        mockFileManager,
      );
    });

    it("calls fileManager.readDistributors() to load distributor data", async () => {
      const mockDistributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
          last_scanned_block: 1000,
        },
        distributors: {
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
            method: "0xfcdde2b4",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: true,
            distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
        },
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(undefined);

      await collector.processDistributors();

      expect(mockFileManager.readDistributors).toHaveBeenCalledTimes(1);
    });

    it("returns early when no distributors are found in storage", async () => {
      mockFileManager.readDistributors.mockReturnValue(undefined);

      await collector.processDistributors();

      expect(mockFileManager.readDistributors).toHaveBeenCalledTimes(1);
      // Should not proceed with any further operations
    });

    it("returns early when distributors data has empty distributors object", async () => {
      const emptyDistributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
          last_scanned_block: 1000,
        },
        distributors: {},
      };

      mockFileManager.readDistributors.mockReturnValue(emptyDistributorsData);

      await collector.processDistributors();

      expect(mockFileManager.readDistributors).toHaveBeenCalledTimes(1);
      // Should not proceed with any further operations
    });
  });

  describe("processDistributors - distributor existence validation", () => {
    let collector: TestDailyDistributorDataCollector;
    let mockDistributorsData: DistributorsData;

    beforeEach(() => {
      mockFileManager = {
        readDistributors: jest.fn(),
        readBlockNumbers: jest.fn(),
      } as unknown as jest.Mocked<FileManager>;
      collector = new TestDailyDistributorDataCollector(
        mockProvider,
        mockFileManager,
      );

      mockDistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
          last_scanned_block: 1000,
        },
        distributors: {
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
            method: "0xfcdde2b4",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: true,
            distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
        },
      };
    });

    it("validates distributor exists when specific address is provided", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(undefined);
      const existingAddress = "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB";

      // Should not throw for existing distributor
      await expect(
        collector.processDistributors(existingAddress),
      ).resolves.not.toThrow();
    });

    it("throws error when specified distributor is not found", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      const nonExistentAddress = "0x1234567890123456789012345678901234567890";

      await expect(
        collector.processDistributors(nonExistentAddress),
      ).rejects.toThrow(`Distributor ${nonExistentAddress} not found`);
    });

    it("validates distributor with case-insensitive address comparison", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(undefined);
      const lowercaseAddress = "0x37daa99b1caae0c22670963e103a66ca2c5db2db";

      // Should not throw for case mismatch
      await expect(
        collector.processDistributors(lowercaseAddress),
      ).resolves.not.toThrow();
    });
  });

  describe("helper methods", () => {
    let collector: TestDailyDistributorDataCollector;

    beforeEach(() => {
      collector = new TestDailyDistributorDataCollector(
        mockProvider,
        mockFileManager,
      );
    });

    describe("formatDate", () => {
      it("formats Date object to YYYY-MM-DD string", () => {
        const date = new Date("2022-07-15T12:34:56Z");
        expect(collector.formatDate(date)).toBe("2022-07-15");
      });

      it("handles dates at different times of day consistently", () => {
        const morningDate = new Date("2022-07-15T00:00:00Z");
        const eveningDate = new Date("2022-07-15T23:59:59Z");
        expect(collector.formatDate(morningDate)).toBe("2022-07-15");
        expect(collector.formatDate(eveningDate)).toBe("2022-07-15");
      });

      it("handles month boundaries correctly", () => {
        const endOfMonth = new Date("2022-07-31T12:00:00Z");
        const startOfMonth = new Date("2022-08-01T12:00:00Z");
        expect(collector.formatDate(endOfMonth)).toBe("2022-07-31");
        expect(collector.formatDate(startOfMonth)).toBe("2022-08-01");
      });

      it("handles year boundaries correctly", () => {
        const endOfYear = new Date("2022-12-31T12:00:00Z");
        const startOfYear = new Date("2023-01-01T12:00:00Z");
        expect(collector.formatDate(endOfYear)).toBe("2022-12-31");
        expect(collector.formatDate(startOfYear)).toBe("2023-01-01");
      });
    });

    describe("findDateForBlock", () => {
      it("finds the correct date for a given block number", () => {
        const blockNumbersData = {
          metadata: { chain_id: 42170 },
          blocks: {
            "2022-07-11": 100,
            "2022-07-12": 200,
            "2022-07-13": 300,
          },
        };

        expect(collector.findDateForBlock(blockNumbersData, 50)).toBe(
          "2022-07-11",
        );
        expect(collector.findDateForBlock(blockNumbersData, 100)).toBe(
          "2022-07-11",
        );
        expect(collector.findDateForBlock(blockNumbersData, 150)).toBe(
          "2022-07-12",
        );
        expect(collector.findDateForBlock(blockNumbersData, 200)).toBe(
          "2022-07-12",
        );
        expect(collector.findDateForBlock(blockNumbersData, 250)).toBe(
          "2022-07-13",
        );
        expect(collector.findDateForBlock(blockNumbersData, 300)).toBe(
          "2022-07-13",
        );
      });

      it("returns null for blocks after the last known block", () => {
        const blockNumbersData = {
          metadata: { chain_id: 42170 },
          blocks: {
            "2022-07-11": 100,
            "2022-07-12": 200,
          },
        };

        expect(collector.findDateForBlock(blockNumbersData, 201)).toBeNull();
        expect(collector.findDateForBlock(blockNumbersData, 999)).toBeNull();
      });

      it("handles empty block data", () => {
        const blockNumbersData = {
          metadata: { chain_id: 42170 },
          blocks: {},
        };

        expect(collector.findDateForBlock(blockNumbersData, 100)).toBeNull();
      });
    });

    describe("convertDateToBlockRange", () => {
      it("converts a date to correct block range", () => {
        const blockNumbersData = {
          metadata: { chain_id: 42170 },
          blocks: {
            "2022-07-11": 100,
            "2022-07-12": 200,
            "2022-07-13": 300,
          },
        };

        expect(
          collector.convertDateToBlockRange("2022-07-12", blockNumbersData),
        ).toEqual({
          startBlock: 101, // Previous day's end block + 1
          endBlock: 200,
        });

        expect(
          collector.convertDateToBlockRange("2022-07-13", blockNumbersData),
        ).toEqual({
          startBlock: 201,
          endBlock: 300,
        });
      });

      it("handles first date in block data", () => {
        const blockNumbersData = {
          metadata: { chain_id: 42170 },
          blocks: {
            "2022-07-11": 100,
            "2022-07-12": 200,
          },
        };

        expect(
          collector.convertDateToBlockRange("2022-07-11", blockNumbersData),
        ).toEqual({
          startBlock: 1, // No previous day, so start from block 1
          endBlock: 100,
        });
      });

      it("throws error when date not found in block data", () => {
        const blockNumbersData = {
          metadata: { chain_id: 42170 },
          blocks: {
            "2022-07-11": 100,
            "2022-07-12": 200,
          },
        };

        expect(() =>
          collector.convertDateToBlockRange("2022-07-14", blockNumbersData),
        ).toThrow("Block number not found for date 2022-07-14");
      });
    });
  });
});

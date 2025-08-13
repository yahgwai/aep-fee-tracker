import { Configuration } from "../../../../src/types";
import { orchestrate } from "../../../../src/infrastructure/orchestration/orchestrator";
import { BlockFinder } from "../../../../src/core/block-processing/block-finder";
import { DistributorDetector } from "../../../../src/core/distributor-detection/distributor-detector";
import { BalanceFetcher } from "../../../../src/core/fee-calculation/balance-fetcher";
import { RecipientRecievedScanner } from "../../../../src/core/fee-calculation/recipient-recieved-scanner";
import { FeeCalculator } from "../../../../src/core/fee-calculation/fee-calculator";
import { FileManager } from "../../../../src/infrastructure/storage/file-manager";
import { ethers } from "ethers";

jest.mock("../../../../src/core/block-processing/block-finder");
jest.mock("../../../../src/core/distributor-detection/distributor-detector");
jest.mock("../../../../src/core/fee-calculation/balance-fetcher");
jest.mock("../../../../src/core/fee-calculation/recipient-recieved-scanner");
jest.mock("../../../../src/core/fee-calculation/fee-calculator");
jest.mock("../../../../src/infrastructure/storage/file-manager");
jest.mock("ethers", () => ({
  ethers: {
    JsonRpcProvider: jest.fn(),
    id: jest.fn(() => "0x1234567890abcdef"),
    Interface: jest.fn(() => ({
      parseLog: jest.fn(),
    })),
  },
  Interface: jest.fn(() => ({
    parseLog: jest.fn(),
  })),
}));

describe("orchestrator", () => {
  let mockFileManager: jest.Mocked<FileManager>;
  let mockProvider: jest.Mocked<ethers.Provider>;
  let mockBlockFinder: jest.Mocked<BlockFinder>;
  let mockDistributorDetector: jest.Mocked<DistributorDetector>;
  let mockBalanceFetcher: jest.Mocked<BalanceFetcher>;
  let mockRecipientRecievedScanner: jest.Mocked<RecipientRecievedScanner>;
  let mockFeeCalculator: jest.Mocked<FeeCalculator>;

  const configuration: Configuration = {
    storeDirectory: "/test/store",
    rpcUrl: "https://test-rpc.example.com",
    startDate: "2024-01-01",
    endDate: "2024-01-31",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockFileManager = {
      ensureStoreDirectory: jest.fn(),
      getMaxDate: jest.fn(),
      getMinDate: jest.fn(),
    } as unknown as jest.Mocked<FileManager>;

    mockProvider = {
      getBlock: jest.fn(),
      getBlockNumber: jest.fn(),
    } as unknown as jest.Mocked<ethers.Provider>;

    // Mock constructors
    (FileManager as jest.MockedClass<typeof FileManager>).mockImplementation(
      () => mockFileManager,
    );

    (ethers.JsonRpcProvider as unknown as jest.Mock).mockImplementation(
      () => mockProvider,
    );

    // Create component mocks
    mockBlockFinder = {
      findBlocksForDateRange: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<BlockFinder>;

    mockDistributorDetector = {
      detectDistributors: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<DistributorDetector>;

    mockBalanceFetcher = {
      fetchBalances: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<BalanceFetcher>;

    mockRecipientRecievedScanner = {
      scan: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RecipientRecievedScanner>;

    mockFeeCalculator = {
      calculateFees: jest.fn(),
    } as unknown as jest.Mocked<FeeCalculator>;

    // Mock component constructors
    (BlockFinder as jest.MockedClass<typeof BlockFinder>).mockImplementation(
      () => mockBlockFinder,
    );

    (
      DistributorDetector as jest.MockedClass<typeof DistributorDetector>
    ).mockImplementation(() => mockDistributorDetector);

    (
      BalanceFetcher as jest.MockedClass<typeof BalanceFetcher>
    ).mockImplementation(() => mockBalanceFetcher);

    (
      RecipientRecievedScanner as jest.MockedClass<
        typeof RecipientRecievedScanner
      >
    ).mockImplementation(() => mockRecipientRecievedScanner);

    (
      FeeCalculator as jest.MockedClass<typeof FeeCalculator>
    ).mockImplementation(() => mockFeeCalculator);
  });

  describe("orchestrate function", () => {
    it("should be exported as a function", () => {
      expect(typeof orchestrate).toBe("function");
    });

    it("should accept a Configuration parameter", async () => {
      await orchestrate(configuration);
      expect(FileManager).toHaveBeenCalledWith(configuration.storeDirectory);
    });

    it("should execute components in the correct order", async () => {
      const callOrder: string[] = [];

      mockBlockFinder.findBlocksForDateRange.mockImplementation(async () => {
        callOrder.push("blockFinder");
        return {} as never;
      });

      mockDistributorDetector.detectDistributors.mockImplementation(
        async () => {
          callOrder.push("distributorDetector");
          return {} as never;
        },
      );

      mockBalanceFetcher.fetchBalances.mockImplementation(async () => {
        callOrder.push("balanceFetcher");
        return {} as never;
      });

      mockRecipientRecievedScanner.scan.mockImplementation(async () => {
        callOrder.push("recipientRecievedScanner");
      });

      mockFeeCalculator.calculateFees.mockImplementation(() => {
        callOrder.push("feeCalculator");
      });

      await orchestrate(configuration);

      expect(callOrder).toEqual([
        "blockFinder",
        "distributorDetector",
        "balanceFetcher",
        "recipientRecievedScanner",
        "feeCalculator",
      ]);
    });

    it("should wait for each component to complete before starting the next", async () => {
      let blockFinderCompleted = false;
      let distributorDetectorStarted = false;

      mockBlockFinder.findBlocksForDateRange.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        blockFinderCompleted = true;
        return {} as never;
      });

      mockDistributorDetector.detectDistributors.mockImplementation(
        async () => {
          distributorDetectorStarted = true;
          expect(blockFinderCompleted).toBe(true);
          return {} as never;
        },
      );

      await orchestrate(configuration);

      expect(distributorDetectorStarted).toBe(true);
    });

    it("should pass configuration with dates to blockFinder", async () => {
      await orchestrate(configuration);

      expect(mockBlockFinder.findBlocksForDateRange).toHaveBeenCalledWith(
        new Date(configuration.startDate!),
        new Date(configuration.endDate!),
      );
    });

    it("should use provided dates when specified", async () => {
      const customConfig: Configuration = {
        storeDirectory: "/test/store",
        rpcUrl: "https://test-rpc.example.com",
        startDate: "2023-06-01",
        endDate: "2023-06-30",
      };

      await orchestrate(customConfig);

      // Should not call getBlock when dates are provided
      expect(mockProvider.getBlock).not.toHaveBeenCalled();

      const callArgs = mockBlockFinder.findBlocksForDateRange.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [startDate, endDate] = callArgs!;

      expect(startDate.toISOString()).toBe(
        new Date("2023-06-01").toISOString(),
      );
      expect(endDate.toISOString()).toBe(new Date("2023-06-30").toISOString());
    });

    it("should use store dates as defaults when not provided", async () => {
      const configWithoutDates: Configuration = {
        storeDirectory: "/test/store",
        rpcUrl: "https://test-rpc.example.com",
      };

      // Mock current date for consistent testing
      const mockDate = new Date("2024-05-10T12:00:00Z");
      const originalDate = global.Date;
      global.Date = jest.fn((value?: string | number | Date) => {
        if (value !== undefined) {
          return new originalDate(value);
        }
        return mockDate;
      }) as unknown as DateConstructor;
      global.Date.now = () => mockDate.getTime();
      global.Date.parse = originalDate.parse;
      global.Date.UTC = originalDate.UTC;

      // Mock FileManager methods with specific date range
      mockFileManager.getMinDate.mockReturnValue(new Date("2024-05-01"));
      mockFileManager.getMaxDate.mockReturnValue(new Date("2024-05-03"));

      await orchestrate(configWithoutDates);

      // Should call FileManager.getMaxDate to check for existing data
      expect(mockFileManager.getMaxDate).toHaveBeenCalled();

      // Should NOT call getBlock or getBlockNumber for date calculation
      expect(mockProvider.getBlockNumber).not.toHaveBeenCalled();
      expect(mockProvider.getBlock).not.toHaveBeenCalled();

      const callArgs = mockBlockFinder.findBlocksForDateRange.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [startDate, endDate] = callArgs!;

      // Should use max date (2024-05-03) as start (for subsequent runs)
      expect(startDate.toISOString()).toBe(
        new Date("2024-05-03").toISOString(),
      );
      // Should use yesterday as end date
      // Create expected date the same way getYesterday does (timezone agnostic)
      const expectedYesterday = new Date(mockDate);
      expectedYesterday.setDate(expectedYesterday.getDate() - 1);
      expectedYesterday.setHours(23, 59, 59, 999);
      expect(endDate.toISOString()).toBe(expectedYesterday.toISOString());

      // Restore Date
      global.Date = originalDate;
    });

    it("should not throw error when block store is empty and no dates provided - uses defaults", async () => {
      const configWithoutDates: Configuration = {
        storeDirectory: "/test/store",
        rpcUrl: "https://test-rpc.example.com",
      };

      // Mock current date for consistent testing
      const mockDate = new Date("2024-03-15T12:00:00Z");
      const originalDate = global.Date;
      global.Date = jest.fn((value?: string | number | Date) => {
        if (value !== undefined) {
          return new originalDate(value);
        }
        return mockDate;
      }) as unknown as DateConstructor;
      global.Date.now = () => mockDate.getTime();
      global.Date.parse = originalDate.parse;
      global.Date.UTC = originalDate.UTC;

      // Mock FileManager methods returning null for empty block store
      mockFileManager.getMinDate.mockReturnValue(null);
      mockFileManager.getMaxDate.mockReturnValue(null);

      // Mock block 1 with a specific timestamp
      const block1Timestamp = 1622505600; // June 1, 2021 00:00:00 UTC
      mockProvider.getBlock.mockResolvedValue({
        timestamp: block1Timestamp,
        number: 1,
        hash: "0x1234567890",
      } as never);

      // Should not throw error - uses defaults instead
      await expect(orchestrate(configWithoutDates)).resolves.not.toThrow();

      // Verify defaults were used
      const callArgs = mockBlockFinder.findBlocksForDateRange.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [startDate, endDate] = callArgs!;

      // End date should be yesterday
      // Create expected date the same way getYesterday does (timezone agnostic)
      const expectedYesterday = new Date(mockDate);
      expectedYesterday.setDate(expectedYesterday.getDate() - 1);
      expectedYesterday.setHours(23, 59, 59, 999);
      expect(endDate.toISOString()).toBe(expectedYesterday.toISOString());

      // Start date should be from block 1
      const expectedStartDate = new Date(block1Timestamp * 1000);
      expect(startDate.toISOString()).toBe(expectedStartDate.toISOString());

      // Restore Date
      global.Date = originalDate;
    });

    it("should default end date to yesterday when store is empty and no end date provided", async () => {
      const configWithoutDates: Configuration = {
        storeDirectory: "/test/store",
        rpcUrl: "https://test-rpc.example.com",
      };

      // Mock FileManager methods returning null for empty block store
      mockFileManager.getMinDate.mockReturnValue(null);
      mockFileManager.getMaxDate.mockReturnValue(null);

      // Mock current date to a known value for testing
      const mockDate = new Date("2024-03-15T12:00:00Z");
      const originalDate = global.Date;
      global.Date = jest.fn((value?: string | number | Date) => {
        if (value !== undefined) {
          return new originalDate(value);
        }
        return mockDate;
      }) as unknown as DateConstructor;
      global.Date.now = () => mockDate.getTime();
      global.Date.parse = originalDate.parse;
      global.Date.UTC = originalDate.UTC;

      // Mock block 1 with a specific timestamp
      const block1Timestamp = 1622505600; // June 1, 2021 00:00:00 UTC
      mockProvider.getBlock.mockResolvedValue({
        timestamp: block1Timestamp,
        number: 1,
        hash: "0x1234567890",
      } as never);

      await orchestrate(configWithoutDates);

      // Verify that BlockFinder was called with yesterday as end date
      // Create expected date the same way getYesterday does (timezone agnostic)
      const expectedYesterday = new Date(mockDate);
      expectedYesterday.setDate(expectedYesterday.getDate() - 1);
      expectedYesterday.setHours(23, 59, 59, 999);
      const callArgs = mockBlockFinder.findBlocksForDateRange.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [startDate, endDate] = callArgs!;

      // Check end date is yesterday
      expect(endDate.toISOString()).toBe(expectedYesterday.toISOString());

      // Check start date is defined (will be from block 1)
      expect(startDate).toBeDefined();

      // Restore Date
      global.Date = originalDate;
    });

    it("should use block 1 date as start date when store is empty and no start date provided", async () => {
      const configWithoutDates: Configuration = {
        storeDirectory: "/test/store",
        rpcUrl: "https://test-rpc.example.com",
      };

      // Mock FileManager methods returning null for empty block store
      mockFileManager.getMinDate.mockReturnValue(null);
      mockFileManager.getMaxDate.mockReturnValue(null);

      // Mock current date to a known value for testing
      const mockDate = new Date("2024-03-15T12:00:00Z");
      const originalDate = global.Date;
      global.Date = jest.fn((value?: string | number | Date) => {
        if (value !== undefined) {
          return new originalDate(value);
        }
        return mockDate;
      }) as unknown as DateConstructor;
      global.Date.now = () => mockDate.getTime();
      global.Date.parse = originalDate.parse;
      global.Date.UTC = originalDate.UTC;

      // Mock block 1 with a specific timestamp
      const block1Timestamp = 1622505600; // June 1, 2021 00:00:00 UTC
      mockProvider.getBlock.mockResolvedValue({
        timestamp: block1Timestamp,
        number: 1,
        hash: "0x1234567890",
      } as never);

      await orchestrate(configWithoutDates);

      // Verify provider.getBlock(1) was called
      expect(mockProvider.getBlock).toHaveBeenCalledWith(1);

      const callArgs = mockBlockFinder.findBlocksForDateRange.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [startDate, endDate] = callArgs!;

      // Check start date is from block 1
      expect(startDate).toBeDefined();
      const expectedStartDate = new Date(block1Timestamp * 1000);
      expect(startDate.toISOString()).toBe(expectedStartDate.toISOString());

      // Verify end date is still yesterday
      // Create expected date the same way getYesterday does (timezone agnostic)
      const expectedYesterday = new Date(mockDate);
      expectedYesterday.setDate(expectedYesterday.getDate() - 1);
      expectedYesterday.setHours(23, 59, 59, 999);
      expect(endDate.toISOString()).toBe(expectedYesterday.toISOString());

      // Restore Date
      global.Date = originalDate;
    });

    it("should throw error when block 1 cannot be fetched on first run", async () => {
      const configWithoutDates: Configuration = {
        storeDirectory: "/test/store",
        rpcUrl: "https://test-rpc.example.com",
      };

      // Mock FileManager methods returning null for empty block store
      mockFileManager.getMinDate.mockReturnValue(null);
      mockFileManager.getMaxDate.mockReturnValue(null);

      // Mock block 1 fetch failure
      mockProvider.getBlock.mockResolvedValue(null);

      await expect(orchestrate(configWithoutDates)).rejects.toThrow(
        "Unable to fetch block 1 from the network",
      );
    });

    it("should use max date from store as start date on subsequent runs when no start date provided", async () => {
      const configWithoutDates: Configuration = {
        storeDirectory: "/test/store",
        rpcUrl: "https://test-rpc.example.com",
      };

      // Mock FileManager methods with existing data in store
      // Create max date with end-of-day time in local timezone
      const existingMaxDate = new Date("2024-03-10");
      existingMaxDate.setHours(23, 59, 59, 999);
      const existingMinDate = new Date("2024-03-01T00:00:00.000Z");
      mockFileManager.getMinDate.mockReturnValue(existingMinDate);
      mockFileManager.getMaxDate.mockReturnValue(existingMaxDate);

      // Mock current date to a known value for testing
      const mockDate = new Date("2024-03-15T12:00:00Z");
      const originalDate = global.Date;
      global.Date = jest.fn((value?: string | number | Date) => {
        if (value !== undefined) {
          return new originalDate(value);
        }
        return mockDate;
      }) as unknown as DateConstructor;
      global.Date.now = () => mockDate.getTime();
      global.Date.parse = originalDate.parse;
      global.Date.UTC = originalDate.UTC;

      await orchestrate(configWithoutDates);

      const callArgs = mockBlockFinder.findBlocksForDateRange.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [startDate, endDate] = callArgs!;

      // Should use max date from store as start date
      expect(startDate.toISOString()).toBe(existingMaxDate.toISOString());

      // Should still default end date to yesterday
      // Create expected date the same way getYesterday does (timezone agnostic)
      const expectedYesterday = new Date(mockDate);
      expectedYesterday.setDate(expectedYesterday.getDate() - 1);
      expectedYesterday.setHours(23, 59, 59, 999);
      expect(endDate.toISOString()).toBe(expectedYesterday.toISOString());

      // Restore Date
      global.Date = originalDate;
    });

    it("should handle edge case when max date in store is after yesterday", async () => {
      const configWithoutDates: Configuration = {
        storeDirectory: "/test/store",
        rpcUrl: "https://test-rpc.example.com",
      };

      // Mock current date to a known value for testing
      const mockDate = new Date("2024-03-15T12:00:00Z");
      const originalDate = global.Date;
      global.Date = jest.fn((value?: string | number | Date) => {
        if (value !== undefined) {
          return new originalDate(value);
        }
        return mockDate;
      }) as unknown as DateConstructor;
      global.Date.now = () => mockDate.getTime();
      global.Date.parse = originalDate.parse;
      global.Date.UTC = originalDate.UTC;

      // Mock FileManager with max date that's after yesterday
      // Create future max date with end-of-day time in local timezone
      const futureMaxDate = new Date("2024-03-16"); // In the future
      futureMaxDate.setHours(23, 59, 59, 999);
      const existingMinDate = new Date("2024-03-01T00:00:00.000Z");
      mockFileManager.getMinDate.mockReturnValue(existingMinDate);
      mockFileManager.getMaxDate.mockReturnValue(futureMaxDate);

      await orchestrate(configWithoutDates);

      const callArgs = mockBlockFinder.findBlocksForDateRange.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [startDate, endDate] = callArgs!;

      // Should ensure start date is not after end date
      expect(startDate <= endDate).toBe(true);

      // End date should still be yesterday
      // Create expected date the same way getYesterday does (timezone agnostic)
      const expectedYesterday = new Date(mockDate);
      expectedYesterday.setDate(expectedYesterday.getDate() - 1);
      expectedYesterday.setHours(23, 59, 59, 999);
      expect(endDate.toISOString()).toBe(expectedYesterday.toISOString());

      // Restore Date
      global.Date = originalDate;
    });

    it("should pass endDate to distributorDetector", async () => {
      await orchestrate(configuration);

      expect(mockDistributorDetector.detectDistributors).toHaveBeenCalledWith(
        new Date(configuration.endDate!),
      );
    });

    it("should call balanceFetcher without parameters", async () => {
      await orchestrate(configuration);

      expect(mockBalanceFetcher.fetchBalances).toHaveBeenCalledWith();
    });

    it("should call recipientRecievedScanner without parameters", async () => {
      await orchestrate(configuration);

      expect(mockRecipientRecievedScanner.scan).toHaveBeenCalledWith();
    });

    it("should call feeCalculator without parameters", async () => {
      await orchestrate(configuration);

      expect(mockFeeCalculator.calculateFees).toHaveBeenCalledWith();
    });

    it("should create FileManager with store directory", async () => {
      await orchestrate(configuration);

      expect(FileManager).toHaveBeenCalledWith(configuration.storeDirectory);
    });

    it("should create Provider with RPC URL", async () => {
      await orchestrate(configuration);

      expect(ethers.JsonRpcProvider).toHaveBeenCalledWith(configuration.rpcUrl);
    });

    it("should ensure store directory exists", async () => {
      await orchestrate(configuration);

      expect(mockFileManager.ensureStoreDirectory).toHaveBeenCalled();
    });

    it("should initialize all components with correct dependencies", async () => {
      await orchestrate(configuration);

      expect(BlockFinder).toHaveBeenCalledWith(mockFileManager, mockProvider);
      expect(DistributorDetector).toHaveBeenCalledWith(
        mockFileManager,
        mockProvider,
      );
      expect(BalanceFetcher).toHaveBeenCalledWith(
        mockFileManager,
        mockProvider,
      );
      expect(RecipientRecievedScanner).toHaveBeenCalledWith(
        mockProvider,
        mockFileManager,
      );
      expect(FeeCalculator).toHaveBeenCalledWith(mockFileManager);
    });

    describe("error propagation", () => {
      it("should propagate error when BlockFinder fails", async () => {
        const blockFinderError = new Error(
          "BlockFinder failed to fetch blocks",
        );
        mockBlockFinder.findBlocksForDateRange.mockRejectedValue(
          blockFinderError,
        );

        await expect(orchestrate(configuration)).rejects.toThrow(
          "BlockFinder failed to fetch blocks",
        );

        // Verify subsequent components were not called
        expect(
          mockDistributorDetector.detectDistributors,
        ).not.toHaveBeenCalled();
        expect(mockBalanceFetcher.fetchBalances).not.toHaveBeenCalled();
        expect(mockRecipientRecievedScanner.scan).not.toHaveBeenCalled();
        expect(mockFeeCalculator.calculateFees).not.toHaveBeenCalled();
      });

      it("should propagate error when DistributorDetector fails", async () => {
        const distributorError = new Error("Failed to detect distributors");
        mockDistributorDetector.detectDistributors.mockRejectedValue(
          distributorError,
        );

        await expect(orchestrate(configuration)).rejects.toThrow(
          "Failed to detect distributors",
        );

        // Verify BlockFinder was called but subsequent components were not
        expect(mockBlockFinder.findBlocksForDateRange).toHaveBeenCalled();
        expect(mockBalanceFetcher.fetchBalances).not.toHaveBeenCalled();
        expect(mockRecipientRecievedScanner.scan).not.toHaveBeenCalled();
        expect(mockFeeCalculator.calculateFees).not.toHaveBeenCalled();
      });

      it("should propagate error when BalanceFetcher fails", async () => {
        const balanceError = new Error("Failed to fetch balances");
        mockBalanceFetcher.fetchBalances.mockRejectedValue(balanceError);

        await expect(orchestrate(configuration)).rejects.toThrow(
          "Failed to fetch balances",
        );

        // Verify earlier components were called but subsequent were not
        expect(mockBlockFinder.findBlocksForDateRange).toHaveBeenCalled();
        expect(mockDistributorDetector.detectDistributors).toHaveBeenCalled();
        expect(mockRecipientRecievedScanner.scan).not.toHaveBeenCalled();
        expect(mockFeeCalculator.calculateFees).not.toHaveBeenCalled();
      });

      it("should propagate error when RecipientRecievedScanner fails", async () => {
        const scannerError = new Error("Failed to scan recipient events");
        mockRecipientRecievedScanner.scan.mockRejectedValue(scannerError);

        await expect(orchestrate(configuration)).rejects.toThrow(
          "Failed to scan recipient events",
        );

        // Verify earlier components were called but FeeCalculator was not
        expect(mockBlockFinder.findBlocksForDateRange).toHaveBeenCalled();
        expect(mockDistributorDetector.detectDistributors).toHaveBeenCalled();
        expect(mockBalanceFetcher.fetchBalances).toHaveBeenCalled();
        expect(mockFeeCalculator.calculateFees).not.toHaveBeenCalled();
      });

      it("should propagate error when FeeCalculator fails", async () => {
        const feeError = new Error("Failed to calculate fees");
        mockFeeCalculator.calculateFees.mockImplementation(() => {
          throw feeError;
        });

        await expect(orchestrate(configuration)).rejects.toThrow(
          "Failed to calculate fees",
        );

        // Verify all earlier components were called
        expect(mockBlockFinder.findBlocksForDateRange).toHaveBeenCalled();
        expect(mockDistributorDetector.detectDistributors).toHaveBeenCalled();
        expect(mockBalanceFetcher.fetchBalances).toHaveBeenCalled();
        expect(mockRecipientRecievedScanner.scan).toHaveBeenCalled();
      });

      it("should propagate error when provider initialization fails", async () => {
        const providerError = new Error("Failed to connect to RPC");
        (ethers.JsonRpcProvider as unknown as jest.Mock).mockImplementation(
          () => {
            throw providerError;
          },
        );

        await expect(orchestrate(configuration)).rejects.toThrow(
          "Failed to connect to RPC",
        );

        // Verify no components were called
        expect(mockBlockFinder.findBlocksForDateRange).not.toHaveBeenCalled();
        expect(
          mockDistributorDetector.detectDistributors,
        ).not.toHaveBeenCalled();
        expect(mockBalanceFetcher.fetchBalances).not.toHaveBeenCalled();
        expect(mockRecipientRecievedScanner.scan).not.toHaveBeenCalled();
        expect(mockFeeCalculator.calculateFees).not.toHaveBeenCalled();
      });

      it("should propagate error when FileManager initialization fails", async () => {
        const fileError = new Error("Failed to access store directory");
        (
          FileManager as jest.MockedClass<typeof FileManager>
        ).mockImplementation(() => {
          throw fileError;
        });

        await expect(orchestrate(configuration)).rejects.toThrow(
          "Failed to access store directory",
        );

        // Verify no components were called
        expect(mockBlockFinder.findBlocksForDateRange).not.toHaveBeenCalled();
        expect(
          mockDistributorDetector.detectDistributors,
        ).not.toHaveBeenCalled();
        expect(mockBalanceFetcher.fetchBalances).not.toHaveBeenCalled();
        expect(mockRecipientRecievedScanner.scan).not.toHaveBeenCalled();
        expect(mockFeeCalculator.calculateFees).not.toHaveBeenCalled();
      });
    });
  });
});

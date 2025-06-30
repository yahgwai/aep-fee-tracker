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

    it("should use block 1 timestamp and safe block timestamp when no dates provided", async () => {
      const configWithoutDates: Configuration = {
        storeDirectory: "/test/store",
        rpcUrl: "https://test-rpc.example.com",
      };

      // Mock current block number
      const currentBlockNumber = 5000;
      mockProvider.getBlockNumber.mockResolvedValue(currentBlockNumber);

      // Mock block 1 with a timestamp (July 12, 2022 UTC)
      const block1Timestamp = Math.floor(
        new Date("2022-07-12T00:00:00Z").getTime() / 1000,
      );

      // Mock safe block timestamp (June 29, 2025 UTC)
      const safeBlockTimestamp = Math.floor(
        new Date("2025-06-29T12:30:45Z").getTime() / 1000,
      );

      mockProvider.getBlock.mockImplementation(async (blockNumber) => {
        if (blockNumber === 1) {
          return {
            timestamp: block1Timestamp,
          } as unknown as ethers.Block;
        } else if (blockNumber === currentBlockNumber - 100) {
          // SAFE_BLOCK_OFFSET
          return {
            timestamp: safeBlockTimestamp,
          } as unknown as ethers.Block;
        }
        return null;
      });

      const chainStartDate = new Date(block1Timestamp * 1000);
      chainStartDate.setUTCHours(0, 0, 0, 0);

      // Expected end date is one day before safe block timestamp
      const expectedEndDate = new Date(safeBlockTimestamp * 1000);
      expectedEndDate.setUTCDate(expectedEndDate.getUTCDate() - 1);
      expectedEndDate.setUTCHours(0, 0, 0, 0);

      await orchestrate(configWithoutDates);

      // Verify that block 1 was fetched
      expect(mockProvider.getBlock).toHaveBeenCalledWith(1);
      // Verify that safe block was fetched
      expect(mockProvider.getBlock).toHaveBeenCalledWith(
        currentBlockNumber - 100,
      );
      // Verify that current block number was fetched
      expect(mockProvider.getBlockNumber).toHaveBeenCalled();

      const callArgs = mockBlockFinder.findBlocksForDateRange.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [startDate, endDate] = callArgs!;

      expect(startDate.toISOString()).toBe(chainStartDate.toISOString());
      expect(endDate.toISOString()).toBe(expectedEndDate.toISOString());
    });

    it("should throw error when block 1 cannot be fetched", async () => {
      const configWithoutDates: Configuration = {
        storeDirectory: "/test/store",
        rpcUrl: "https://test-rpc.example.com",
      };

      // Mock getBlockNumber for the end date calculation
      mockProvider.getBlockNumber.mockResolvedValue(5000);

      // Mock getBlock to return null for block 1, but valid for safe block
      mockProvider.getBlock.mockImplementation(async (blockNumber) => {
        if (blockNumber === 1) {
          return null;
        } else if (blockNumber === 4900) {
          // Safe block
          return {
            timestamp: Math.floor(Date.now() / 1000),
          } as unknown as ethers.Block;
        }
        return null;
      });

      await expect(orchestrate(configWithoutDates)).rejects.toThrow(
        "Failed to fetch block 1 from provider",
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

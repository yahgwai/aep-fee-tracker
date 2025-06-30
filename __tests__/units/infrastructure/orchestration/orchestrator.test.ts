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

      // Mock block numbers data with specific date range
      mockFileManager.readBlockNumbers = jest.fn().mockReturnValue({
        metadata: { chain_id: 42170 },
        blocks: {
          "2024-05-01": 1000,
          "2024-05-02": 2000,
          "2024-05-03": 3000, // Max date in store
        },
      });

      await orchestrate(configWithoutDates);

      // Should read block numbers to get date range
      expect(mockFileManager.readBlockNumbers).toHaveBeenCalled();

      // Should NOT call getBlock or getBlockNumber for date calculation
      expect(mockProvider.getBlockNumber).not.toHaveBeenCalled();
      expect(mockProvider.getBlock).not.toHaveBeenCalled();

      const callArgs = mockBlockFinder.findBlocksForDateRange.mock.calls[0];
      expect(callArgs).toBeDefined();
      const [startDate, endDate] = callArgs!;

      // Should use min date (2024-05-01) as start
      expect(startDate.toISOString()).toBe(
        new Date("2024-05-01").toISOString(),
      );
      // Should use max date (2024-05-03) as end
      expect(endDate.toISOString()).toBe(new Date("2024-05-03").toISOString());
    });

    it("should throw error when block store is empty and no dates provided", async () => {
      const configWithoutDates: Configuration = {
        storeDirectory: "/test/store",
        rpcUrl: "https://test-rpc.example.com",
      };

      // Mock empty block numbers data
      mockFileManager.readBlockNumbers = jest.fn().mockReturnValue({
        metadata: { chain_id: 42170 },
        blocks: {},
      });

      await expect(orchestrate(configWithoutDates)).rejects.toThrow(
        "No block numbers found in store and no dates provided",
      );
    });

    it("should throw error when block store is missing and no dates provided", async () => {
      const configWithoutDates: Configuration = {
        storeDirectory: "/test/store",
        rpcUrl: "https://test-rpc.example.com",
      };

      // Mock missing block numbers data
      mockFileManager.readBlockNumbers = jest.fn().mockReturnValue(undefined);

      await expect(orchestrate(configWithoutDates)).rejects.toThrow(
        "No block numbers found in store and no dates provided",
      );
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

import { ethers } from "ethers";
import { FileManager } from "../../src/file-manager";
import { BalanceFetcher } from "../../src/balance-fetcher";
import {
  DistributorType,
  DistributorsData,
  BlockNumberData,
  withRetry,
} from "../../src/types";

jest.mock("../../src/file-manager");
jest.mock("../../src/types", () => ({
  ...jest.requireActual("../../src/types"),
  withRetry: jest.fn(),
}));

describe("BalanceFetcher - RPC Balance Fetching", () => {
  let mockFileManager: jest.Mocked<FileManager>;
  let mockProvider: jest.Mocked<ethers.Provider>;
  let fetcher: BalanceFetcher;
  let mockWithRetry: jest.MockedFunction<typeof withRetry>;

  beforeEach(() => {
    mockFileManager = {
      readDistributors: jest.fn(),
      readBlockNumbers: jest.fn(),
      readDistributorBalances: jest.fn(),
      writeDistributorBalances: jest.fn(),
    } as unknown as jest.Mocked<FileManager>;
    mockProvider = {
      getBalance: jest.fn(),
    } as unknown as jest.Mocked<ethers.Provider>;
    fetcher = new BalanceFetcher(mockFileManager, mockProvider);
    mockWithRetry = withRetry as jest.MockedFunction<typeof withRetry>;

    // Reset mock implementation
    mockWithRetry.mockImplementation((operation) => operation());
  });

  describe("RPC calls with retry logic", () => {
    let mockDistributorsData: DistributorsData;
    let mockBlockNumberData: BlockNumberData;

    beforeEach(() => {
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

      mockBlockNumberData = {
        metadata: {
          chain_id: 42170,
        },
        blocks: {
          "2022-07-12": 155,
          "2022-07-13": 189,
        },
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumberData);
      mockFileManager.readDistributorBalances.mockReturnValue(undefined);
    });

    it("wraps getBalance calls with withRetry utility", async () => {
      const mockHexBalance = "0x3635c9adc5dea00000";
      mockProvider.getBalance.mockResolvedValue(BigInt(mockHexBalance));

      await fetcher.fetchBalances();

      // Verify withRetry was called for each balance fetch
      expect(mockWithRetry).toHaveBeenCalledTimes(2); // Two dates to fetch

      // Verify withRetry was called with correct parameters
      expect(mockWithRetry).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          maxRetries: 3,
          operationName: expect.stringContaining("getBalance"),
        }),
      );
    });

    it("configures withRetry with 3 max retries", async () => {
      const mockHexBalance = "0x3635c9adc5dea00000";
      mockProvider.getBalance.mockResolvedValue(BigInt(mockHexBalance));

      await fetcher.fetchBalances();

      // Verify all calls used maxRetries: 3
      expect(mockWithRetry).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          maxRetries: 3,
        }),
      );
    });

    it("includes descriptive operation name for each RPC call", async () => {
      const mockHexBalance = "0x3635c9adc5dea00000";
      mockProvider.getBalance.mockResolvedValue(BigInt(mockHexBalance));

      await fetcher.fetchBalances();

      // Check that operation names include address and block info
      const calls = mockWithRetry.mock.calls;
      expect(calls[0]?.[1]?.operationName).toContain(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      );
      expect(calls[0]?.[1]?.operationName).toContain("155");
    });
  });

  describe("storing raw hex balance responses", () => {
    let mockDistributorsData: DistributorsData;
    let mockBlockNumberData: BlockNumberData;

    beforeEach(() => {
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

      mockBlockNumberData = {
        metadata: {
          chain_id: 42170,
        },
        blocks: {
          "2022-07-12": 155,
          "2022-07-13": 189,
        },
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumberData);
      mockFileManager.readDistributorBalances.mockReturnValue(undefined);
    });

    it("returns collected raw hex balances", async () => {
      // Set up different balances for different dates
      const balances = {
        "2022-07-12": BigInt("0x3635c9adc5dea00000"), // 1000 ETH in hex
        "2022-07-13": BigInt("0x6c6b935b8bbd400000"), // 2000 ETH in hex
      };

      mockProvider.getBalance.mockImplementation(async (_address, block) => {
        if (block === 155) return balances["2022-07-12"];
        if (block === 189) return balances["2022-07-13"];
        throw new Error(`Unexpected block: ${block}`);
      });

      const result = await fetcher.fetchBalances();

      // Verify the returned structure contains raw hex values
      expect(result).toEqual({
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
          "2022-07-12": "0x3635c9adc5dea00000",
          "2022-07-13": "0x6c6b935b8bbd400000",
        },
      });
    });

    it("collects balances for multiple distributors", async () => {
      // Add another distributor
      mockDistributorsData.distributors[
        "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce"
      ] = {
        type: DistributorType.L1_SURPLUS_FEE,
        block: 155,
        date: "2022-07-12",
        tx_hash:
          "0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0",
        method: "0x934be07d",
        owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
        event_data: "0x...",
        is_reward_distributor: true,
        distributor_address: "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce",
      };

      mockProvider.getBalance.mockImplementation(async (address) => {
        if (address === "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB") {
          return BigInt("0x3635c9adc5dea00000");
        }
        if (address === "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce") {
          return BigInt("0x1bc16d674ec80000");
        }
        throw new Error(`Unexpected address: ${address}`);
      });

      const result = await fetcher.fetchBalances();

      expect(result).toEqual({
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
          "2022-07-12": "0x3635c9adc5dea00000",
          "2022-07-13": "0x3635c9adc5dea00000",
        },
        "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce": {
          "2022-07-12": "0x1bc16d674ec80000",
          "2022-07-13": "0x1bc16d674ec80000",
        },
      });
    });
  });

  describe("error handling", () => {
    let mockDistributorsData: DistributorsData;
    let mockBlockNumberData: BlockNumberData;

    beforeEach(() => {
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

      mockBlockNumberData = {
        metadata: {
          chain_id: 42170,
        },
        blocks: {
          "2022-07-12": 155,
        },
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumberData);
      mockFileManager.readDistributorBalances.mockReturnValue(undefined);
    });

    it("throws error when all retry attempts fail", async () => {
      const rpcError = new Error("RPC request failed");

      // Make withRetry actually throw the error
      mockWithRetry.mockRejectedValue(rpcError);

      await expect(fetcher.fetchBalances()).rejects.toThrow(
        "RPC request failed",
      );
    });

    it("propagates errors from withRetry to caller", async () => {
      const networkError = new Error("Network timeout");

      // Simulate withRetry throwing after exhausting retries
      mockWithRetry.mockRejectedValue(networkError);

      await expect(fetcher.fetchBalances()).rejects.toThrow(networkError);
    });
  });
});

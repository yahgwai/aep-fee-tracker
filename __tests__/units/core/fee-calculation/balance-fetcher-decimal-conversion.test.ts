import { ethers } from "ethers";
import { FileManager } from "../../../../src/infrastructure/storage/file-manager";
import { BalanceFetcher } from "../../../../src/core/fee-calculation/balance-fetcher";
import {
  DistributorType,
  DistributorsData,
  BlockNumberData,
} from "../../../../src/types";
import { withRetry } from "../../../../src/utils/retry";

jest.mock("../../../../src/infrastructure/storage/file-manager");
jest.mock("../../../../src/utils/retry", () => ({
  withRetry: jest.fn(),
}));

describe("BalanceFetcher - Decimal String Conversion", () => {
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
      getNetwork: jest
        .fn()
        .mockResolvedValue({ chainId: 42170n } as unknown as ethers.Network),
    } as unknown as jest.Mocked<ethers.Provider>;
    fetcher = new BalanceFetcher(mockFileManager, mockProvider);
    mockWithRetry = withRetry as jest.MockedFunction<typeof withRetry>;

    // Reset mock implementation
    mockWithRetry.mockImplementation((operation) => operation());
  });

  describe("converting bigint balances to decimal strings", () => {
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
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": [
            {
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
          ],
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

    it("returns decimal string instead of bigint for balance values", async () => {
      // RPC returns bigint (simulating hex response 0x5d21dba000)
      const hexBalance = BigInt("0x5d21dba000"); // 400000000000 in decimal
      mockProvider.getBalance.mockResolvedValue(hexBalance);

      const result = await fetcher.fetchBalances();

      // Expect decimal string representation
      expect(result).toEqual({
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
          "2022-07-12": "400000000000",
          "2022-07-13": "400000000000",
        },
      });
    });

    it("converts zero balance correctly", async () => {
      // RPC returns 0 as bigint
      mockProvider.getBalance.mockResolvedValue(BigInt(0));

      const result = await fetcher.fetchBalances();

      // Expect "0" not empty string
      expect(result).toEqual({
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
          "2022-07-12": "0",
          "2022-07-13": "0",
        },
      });
    });

    it("handles very large balance values without scientific notation", async () => {
      // Test with a very large balance (1 million ETH in wei)
      const largeBalance = BigInt("0xd3c21bcecceda1000000"); // 1000000 * 10^18 wei
      mockProvider.getBalance.mockResolvedValue(largeBalance);

      const result = await fetcher.fetchBalances();

      // Should be decimal string without scientific notation
      expect(result).toEqual({
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
          "2022-07-12": "1000000000000000000000000",
          "2022-07-13": "1000000000000000000000000",
        },
      });

      // Verify no scientific notation
      const addressBalances =
        result!["0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"];
      expect(addressBalances).toBeDefined();
      expect(addressBalances!["2022-07-12"]).not.toContain("e");
      expect(addressBalances!["2022-07-12"]).not.toContain("E");
    });

    it("maintains precision for all balance values", async () => {
      // Test with a specific value from test data
      const testBalance = BigInt("11840998262570272"); // From actual test data
      mockProvider.getBalance.mockResolvedValue(testBalance);

      const result = await fetcher.fetchBalances();

      expect(result).toEqual({
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
          "2022-07-12": "11840998262570272",
          "2022-07-13": "11840998262570272",
        },
      });
    });

    it("converts multiple different balances correctly", async () => {
      const balances = {
        155: BigInt("0x5d21dba000"), // 400000000000
        189: BigInt("0x402dcd2fc8000"), // 1129047362666496
      };

      mockProvider.getBalance.mockImplementation(async (_address, block) => {
        return balances[block as keyof typeof balances] || BigInt(0);
      });

      const result = await fetcher.fetchBalances();

      expect(result).toEqual({
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
          "2022-07-12": "400000000000",
          "2022-07-13": "1129047362666496",
        },
      });
    });
  });
});

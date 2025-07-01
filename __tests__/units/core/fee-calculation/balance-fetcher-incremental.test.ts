import { ethers } from "ethers";
import { FileManager } from "../../../../src/infrastructure/storage/file-manager";
import { BalanceFetcher } from "../../../../src/core/fee-calculation/balance-fetcher";
import {
  DistributorType,
  DistributorsData,
  BlockNumberData,
  BalanceData,
} from "../../../../src/types";

jest.mock("../../../../src/infrastructure/storage/file-manager");

describe("BalanceFetcher - Incremental Processing", () => {
  let mockFileManager: jest.Mocked<FileManager>;
  let mockProvider: jest.Mocked<ethers.Provider>;
  let fetcher: BalanceFetcher;

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
  });

  describe("loading existing balance data", () => {
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
          "2022-07-11": 120,
          "2022-07-12": 155,
          "2022-07-13": 189,
          "2022-08-07": 654,
          "2022-08-08": 672,
        },
      };
    });

    it("calls readDistributorBalances for each distributor being processed", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumberData);
      mockFileManager.readDistributorBalances.mockReturnValue(undefined);
      mockProvider.getBalance.mockResolvedValue(BigInt("1000000000000000000"));

      await fetcher.fetchBalances();

      expect(mockFileManager.readDistributorBalances).toHaveBeenCalledWith(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      );
      expect(mockFileManager.readDistributorBalances).toHaveBeenCalledTimes(1);
    });

    it("calls readDistributorBalances for multiple distributors", async () => {
      const multipleDistributors = {
        ...mockDistributorsData,
        distributors: {
          ...mockDistributorsData.distributors,
          "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce": [
            {
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
            },
          ],
        },
      };

      mockFileManager.readDistributors.mockReturnValue(multipleDistributors);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumberData);
      mockFileManager.readDistributorBalances.mockReturnValue(undefined);
      mockProvider.getBalance.mockResolvedValue(BigInt("1000000000000000000"));

      await fetcher.fetchBalances();

      expect(mockFileManager.readDistributorBalances).toHaveBeenCalledWith(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      );
      expect(mockFileManager.readDistributorBalances).toHaveBeenCalledWith(
        "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce",
      );
      expect(mockFileManager.readDistributorBalances).toHaveBeenCalledTimes(2);
    });

    it("handles non-existent balance files gracefully", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumberData);
      mockFileManager.readDistributorBalances.mockReturnValue(undefined);
      mockProvider.getBalance.mockResolvedValue(BigInt("1000000000000000000"));

      await fetcher.fetchBalances();

      // Should complete without error and fetch all applicable dates
      const expectedDates = [
        "2022-07-12",
        "2022-07-13",
        "2022-08-07",
        "2022-08-08",
      ];
      expect(mockProvider.getBalance).toHaveBeenCalledTimes(
        expectedDates.length,
      );
    });
  });

  describe("identifying missing balances", () => {
    let mockDistributorsData: DistributorsData;
    let mockBlockNumberData: BlockNumberData;
    let mockBalanceData: BalanceData;

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
          "2022-08-07": 654,
          "2022-08-08": 672,
        },
      };

      mockBalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        },
        balances: {
          "2022-07-12": {
            block_number: 155,
            balance_wei: "1000000000000000000",
          },
          "2022-07-13": {
            block_number: 189,
            balance_wei: "2000000000000000000",
          },
        },
      };
    });

    it("only fetches balances for dates that don't exist in balance data", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumberData);
      mockFileManager.readDistributorBalances.mockReturnValue(mockBalanceData);
      mockProvider.getBalance.mockResolvedValue(BigInt("3000000000000000000"));

      await fetcher.fetchBalances();

      // Should only fetch balances for dates not in existing balance data
      // 2022-07-12 and 2022-07-13 already exist, so only fetch 2022-08-07 and 2022-08-08
      expect(mockProvider.getBalance).toHaveBeenCalledTimes(2);
      expect(mockProvider.getBalance).toHaveBeenCalledWith(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        654, // block for 2022-08-07
      );
      expect(mockProvider.getBalance).toHaveBeenCalledWith(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        672, // block for 2022-08-08
      );
    });

    it("fetches all dates when no existing balance data exists", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumberData);
      mockFileManager.readDistributorBalances.mockReturnValue(undefined);
      mockProvider.getBalance.mockResolvedValue(BigInt("1000000000000000000"));

      await fetcher.fetchBalances();

      // Should fetch all applicable dates since no balance data exists
      expect(mockProvider.getBalance).toHaveBeenCalledTimes(4);
    });

    it("skips all fetches when all balances already exist", async () => {
      const completeBalanceData: BalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        },
        balances: {
          "2022-07-12": {
            block_number: 155,
            balance_wei: "1000000000000000000",
          },
          "2022-07-13": {
            block_number: 189,
            balance_wei: "2000000000000000000",
          },
          "2022-08-07": {
            block_number: 654,
            balance_wei: "3000000000000000000",
          },
          "2022-08-08": {
            block_number: 672,
            balance_wei: "4000000000000000000",
          },
        },
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumberData);
      mockFileManager.readDistributorBalances.mockReturnValue(
        completeBalanceData,
      );

      await fetcher.fetchBalances();

      // Should not fetch any balances since all already exist
      expect(mockProvider.getBalance).not.toHaveBeenCalled();
    });

    it("handles distributor creation blocks correctly when identifying missing balances", async () => {
      // Distributor created on a date not in block numbers
      const distributorWithCustomCreationDate = {
        ...mockDistributorsData,
        distributors: {
          "0xTestDistributor": [
            {
              type: DistributorType.L2_BASE_FEE,
              block: 500,
              date: "2022-07-15", // Date not in block numbers
              tx_hash:
                "0x0000000000000000000000000000000000000000000000000000000000000000",
              method: "0x57f585db",
              owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
              event_data: "0x...",
              is_reward_distributor: true,
              distributor_address: "0xTestDistributor",
            },
          ],
        },
      };

      mockFileManager.readDistributors.mockReturnValue(
        distributorWithCustomCreationDate,
      );
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumberData);
      mockFileManager.readDistributorBalances.mockReturnValue(undefined);
      mockProvider.getBalance.mockResolvedValue(BigInt("1000000000000000000"));

      await fetcher.fetchBalances();

      // Should include creation block 500 for date 2022-07-15
      const calls = mockProvider.getBalance.mock.calls;
      const blocksCalled = calls.map((call) => call[1]);
      expect(blocksCalled).toContain(500);
    });
  });
});

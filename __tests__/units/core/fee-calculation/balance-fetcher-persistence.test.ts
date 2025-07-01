import { ethers } from "ethers";
import { FileManager } from "../../../../src/infrastructure/storage/file-manager";
import { BalanceFetcher } from "../../../../src/core/fee-calculation/balance-fetcher";
import {
  DistributorType,
  DistributorsData,
  BlockNumberData,
} from "../../../../src/types";

jest.mock("../../../../src/infrastructure/storage/file-manager");

describe("BalanceFetcher - persistence", () => {
  let mockFileManager: jest.Mocked<FileManager>;
  let mockProvider: jest.Mocked<ethers.Provider>;
  let fetcher: BalanceFetcher;

  const mockDistributorsData: DistributorsData = {
    metadata: {
      chain_id: 42170,
      arbowner_address: "0x0000000000000000000000000000000000000070",
      last_scanned_block: 1000,
    },
    distributors: {
      "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": [{
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
      }],
    },
  };

  const mockBlockNumbersData: BlockNumberData = {
    metadata: {
      chain_id: 42170,
    },
    blocks: {
      "2022-07-12": 152,
      "2022-07-13": 100000,
    },
  };

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

  describe("Cycle 1: Basic Storage of Fetched Balances", () => {
    it("persists fetched balances using FileManager.writeDistributorBalances", async () => {
      // Arrange
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readDistributorBalances.mockReturnValue(undefined); // No existing data

      const mockBalance = ethers.toBigInt("1500000000000000000000");
      mockProvider.getBalance.mockResolvedValue(mockBalance);

      // Act
      await fetcher.fetchBalances();

      // Assert
      expect(mockFileManager.writeDistributorBalances).toHaveBeenCalledWith(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        expect.objectContaining({
          balances: expect.any(Object),
        }),
      );
    });
  });

  describe("Cycle 2: Metadata Creation", () => {
    it("includes correct metadata with chain_id and reward_distributor address", async () => {
      // Arrange
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readDistributorBalances.mockReturnValue(undefined);

      const mockBalance = ethers.toBigInt("1500000000000000000000");
      mockProvider.getBalance.mockResolvedValue(mockBalance);

      // Act
      await fetcher.fetchBalances();

      // Assert
      expect(mockFileManager.writeDistributorBalances).toHaveBeenCalledWith(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        {
          metadata: {
            chain_id: 42170,
            reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
          balances: expect.any(Object),
        },
      );
    });
  });

  describe("Cycle 3: Incremental Merge", () => {
    it("merges new balances with existing balance data", async () => {
      // Arrange
      const existingBalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        },
        balances: {
          "2022-07-12": {
            block_number: 152,
            balance_wei: "1000000000000000000000",
          },
        },
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readDistributorBalances.mockReturnValue(
        existingBalanceData,
      );

      const mockBalance = ethers.toBigInt("1500000000000000000000");
      mockProvider.getBalance.mockResolvedValue(mockBalance);

      // Act
      await fetcher.fetchBalances();

      // Assert
      expect(mockFileManager.writeDistributorBalances).toHaveBeenCalledWith(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        {
          metadata: {
            chain_id: 42170,
            reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
          balances: {
            "2022-07-12": {
              block_number: 152,
              balance_wei: "1000000000000000000000",
            },
            "2022-07-13": {
              block_number: 100000,
              balance_wei: "1500000000000000000000",
            },
          },
        },
      );
    });
  });

  describe("Cycle 4: Multiple Distributors", () => {
    it("saves balance data for all processed distributors", async () => {
      // Arrange
      const multipleDistributorsData: DistributorsData = {
        ...mockDistributorsData,
        distributors: {
          ...mockDistributorsData.distributors,
          "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce": [{
            type: DistributorType.L2_BASE_FEE,
            block: 200,
            date: "2022-07-12",
            tx_hash:
              "0x1234567890123456789012345678901234567890123456789012345678901234",
            method: "0x57f585db",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: true,
            distributor_address: "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce",
          }],
        },
      };

      mockFileManager.readDistributors.mockReturnValue(
        multipleDistributorsData,
      );
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readDistributorBalances.mockReturnValue(undefined);

      const mockBalance1 = ethers.toBigInt("1500000000000000000000");
      const mockBalance2 = ethers.toBigInt("2500000000000000000000");
      mockProvider.getBalance
        .mockResolvedValueOnce(mockBalance1)
        .mockResolvedValueOnce(mockBalance1)
        .mockResolvedValueOnce(mockBalance2)
        .mockResolvedValueOnce(mockBalance2);

      // Act
      await fetcher.fetchBalances();

      // Assert
      expect(mockFileManager.writeDistributorBalances).toHaveBeenCalledTimes(2);
      expect(mockFileManager.writeDistributorBalances).toHaveBeenCalledWith(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        expect.any(Object),
      );
      expect(mockFileManager.writeDistributorBalances).toHaveBeenCalledWith(
        "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce",
        expect.any(Object),
      );
    });
  });

  describe("Cycle 5: Edge Cases", () => {
    it("does not call writeDistributorBalances when no new balances are fetched", async () => {
      // Arrange
      const completeBalanceData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        },
        balances: {
          "2022-07-12": {
            block_number: 152,
            balance_wei: "1000000000000000000000",
          },
          "2022-07-13": {
            block_number: 100000,
            balance_wei: "1500000000000000000000",
          },
        },
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readDistributorBalances.mockReturnValue(
        completeBalanceData,
      );

      // Act
      await fetcher.fetchBalances();

      // Assert
      expect(mockProvider.getBalance).not.toHaveBeenCalled();
      expect(mockFileManager.writeDistributorBalances).not.toHaveBeenCalled();
    });

    it("saves balance data with correct structure for dates and block numbers", async () => {
      // Arrange
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readDistributorBalances.mockReturnValue(undefined);

      const mockBalance1 = ethers.toBigInt("1000000000000000000000");
      const mockBalance2 = ethers.toBigInt("1500000000000000000000");
      mockProvider.getBalance
        .mockResolvedValueOnce(mockBalance1)
        .mockResolvedValueOnce(mockBalance2);

      // Act
      await fetcher.fetchBalances();

      // Assert
      expect(mockFileManager.writeDistributorBalances).toHaveBeenCalledWith(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        {
          metadata: {
            chain_id: 42170,
            reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
          balances: {
            "2022-07-12": {
              block_number: 152,
              balance_wei: "1000000000000000000000",
            },
            "2022-07-13": {
              block_number: 100000,
              balance_wei: "1500000000000000000000",
            },
          },
        },
      );
    });

    it("gets chain ID from provider when creating new balance data", async () => {
      // Arrange
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readDistributorBalances.mockReturnValue(undefined);

      const mockBalance = ethers.toBigInt("1500000000000000000000");
      mockProvider.getBalance.mockResolvedValue(mockBalance);
      mockProvider.getNetwork.mockResolvedValue({
        chainId: 1234n,
      } as unknown as ethers.Network);

      // Act
      await fetcher.fetchBalances();

      // Assert
      expect(mockProvider.getNetwork).toHaveBeenCalled();
      expect(mockFileManager.writeDistributorBalances).toHaveBeenCalledWith(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        expect.objectContaining({
          metadata: expect.objectContaining({
            chain_id: 1234,
          }),
        }),
      );
    });

    it("preserves existing chain ID when balance data already exists", async () => {
      // Arrange
      const existingBalanceData = {
        metadata: {
          chain_id: 9999,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        },
        balances: {
          "2022-07-12": {
            block_number: 152,
            balance_wei: "1000000000000000000000",
          },
        },
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readDistributorBalances.mockReturnValue(
        existingBalanceData,
      );

      const mockBalance = ethers.toBigInt("1500000000000000000000");
      mockProvider.getBalance.mockResolvedValue(mockBalance);
      mockProvider.getNetwork.mockResolvedValue({
        chainId: 42170n,
      } as unknown as ethers.Network);

      // Act
      await fetcher.fetchBalances();

      // Assert
      expect(mockFileManager.writeDistributorBalances).toHaveBeenCalledWith(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        expect.objectContaining({
          metadata: expect.objectContaining({
            chain_id: 9999, // Should preserve existing chain ID
          }),
        }),
      );
    });
  });
});

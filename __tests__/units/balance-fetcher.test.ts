import { ethers } from "ethers";
import { FileManager } from "../../src/file-manager";
import { BalanceFetcher } from "../../src/balance-fetcher";
import {
  DistributorType,
  DistributorsData,
  BlockNumberData,
} from "../../src/types";

jest.mock("../../src/file-manager");

describe("BalanceFetcher", () => {
  let mockFileManager: jest.Mocked<FileManager>;
  let mockProvider: jest.Mocked<ethers.Provider>;

  beforeEach(() => {
    mockFileManager = {
      readDistributors: jest.fn(),
    } as unknown as jest.Mocked<FileManager>;
    mockProvider = {} as jest.Mocked<ethers.Provider>;
  });

  describe("constructor", () => {
    it("can be instantiated with FileManager and Provider dependencies", () => {
      const fetcher = new BalanceFetcher(mockFileManager, mockProvider);
      expect(fetcher).toBeDefined();
      expect(fetcher).toBeInstanceOf(BalanceFetcher);
    });

    it("stores FileManager as readonly property", () => {
      const fetcher = new BalanceFetcher(mockFileManager, mockProvider);
      expect(fetcher.fileManager).toBe(mockFileManager);
    });

    it("stores provider as readonly property", () => {
      const fetcher = new BalanceFetcher(mockFileManager, mockProvider);
      expect(fetcher.provider).toBe(mockProvider);
    });
  });

  describe("fetchBalances", () => {
    let fetcher: BalanceFetcher;

    beforeEach(() => {
      fetcher = new BalanceFetcher(mockFileManager, mockProvider);
    });

    it("exists as a method on BalanceFetcher instance", () => {
      expect(fetcher.fetchBalances).toBeDefined();
      expect(typeof fetcher.fetchBalances).toBe("function");
    });

    it("accepts optional distributorAddress parameter", () => {
      expect(fetcher.fetchBalances.length).toBeLessThanOrEqual(1);
    });

    it("returns a Promise", () => {
      const result = fetcher.fetchBalances();
      expect(result).toBeInstanceOf(Promise);
      result.catch(() => {}); // Prevent unhandled promise rejection
    });
  });

  describe("fetchBalances - loading distributors", () => {
    let fetcher: BalanceFetcher;

    beforeEach(() => {
      mockFileManager = {
        readDistributors: jest.fn(),
        readDistributorBalances: jest.fn(),
        writeDistributorBalances: jest.fn(),
        readBlockNumbers: jest.fn(),
      } as unknown as jest.Mocked<FileManager>;
      mockProvider = {} as jest.Mocked<ethers.Provider>;
      fetcher = new BalanceFetcher(mockFileManager, mockProvider);
    });

    it("calls fileManager.readDistributors() to load distributor data", async () => {
      const mockDistributorsData = {
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
            event_data:
              "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000024fcdde2b400000000000000000000000037daa99b1caae0c22670963e103a66ca2c5db2db00000000000000000000000000000000000000000000000000000000",
            is_reward_distributor: true,
            distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          },
        },
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);

      await fetcher.fetchBalances();

      expect(mockFileManager.readDistributors).toHaveBeenCalledTimes(1);
    });

    it("returns early when no distributors are found in storage", async () => {
      mockFileManager.readDistributors.mockReturnValue(undefined);

      await fetcher.fetchBalances();

      expect(mockFileManager.readDistributors).toHaveBeenCalledTimes(1);
      // Verify no balance data operations occur
      expect(mockFileManager.readDistributorBalances).not.toHaveBeenCalled();
      expect(mockFileManager.writeDistributorBalances).not.toHaveBeenCalled();
    });

    it("returns early when distributors data has empty distributors object", async () => {
      const emptyDistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
          last_scanned_block: 1000,
        },
        distributors: {},
      };

      mockFileManager.readDistributors.mockReturnValue(emptyDistributorsData);

      await fetcher.fetchBalances();

      expect(mockFileManager.readDistributors).toHaveBeenCalledTimes(1);
      // Verify no balance data operations occur
      expect(mockFileManager.readDistributorBalances).not.toHaveBeenCalled();
      expect(mockFileManager.writeDistributorBalances).not.toHaveBeenCalled();
    });
  });

  describe("fetchBalances - loading block numbers", () => {
    let fetcher: BalanceFetcher;
    let mockDistributorsData: DistributorsData;

    beforeEach(() => {
      mockFileManager = {
        readDistributors: jest.fn(),
        readBlockNumbers: jest.fn(),
      } as unknown as jest.Mocked<FileManager>;
      mockProvider = {} as jest.Mocked<ethers.Provider>;
      fetcher = new BalanceFetcher(mockFileManager, mockProvider);

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

    it("calls fileManager.readBlockNumbers() when processing distributors", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);

      await fetcher.fetchBalances();

      expect(mockFileManager.readBlockNumbers).toHaveBeenCalledTimes(1);
    });
  });

  describe("fetchBalances - filtering by creation date", () => {
    let fetcher: BalanceFetcher;
    let mockDistributorsData: DistributorsData;
    let mockBlockNumberData: BlockNumberData;

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
          "2022-08-09": 3584,
          "2023-03-15": 3141957,
          "2023-03-16": 3166694,
          "2023-03-17": 3187362,
        },
      };

      mockDistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
          last_scanned_block: 1000,
        },
        distributors: {
          "0xdff90519a9DE6ad469D4f9839a9220C5D340B792": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 672,
            date: "2022-08-08",
            tx_hash:
              "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
            method: "0xfcdde2b4",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: true,
            distributor_address: "0xdff90519a9DE6ad469D4f9839a9220C5D340B792",
          },
        },
      };
    });

    it("only processes block numbers from distributor creation date onward", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumberData);
      mockFileManager.readDistributorBalances.mockReturnValue(undefined);
      mockProvider.getBalance.mockResolvedValue(BigInt("1000000000000000000"));

      await fetcher.fetchBalances();

      // Should only fetch balances for dates >= 2022-08-08
      const expectedDates = [
        "2022-08-08",
        "2022-08-09",
        "2023-03-15",
        "2023-03-16",
        "2023-03-17",
      ];
      expect(mockProvider.getBalance).toHaveBeenCalledTimes(
        expectedDates.length,
      );

      // Verify each call was made with the correct block number
      expectedDates.forEach((date, index) => {
        expect(mockProvider.getBalance).toHaveBeenNthCalledWith(
          index + 1,
          "0xdff90519a9DE6ad469D4f9839a9220C5D340B792",
          mockBlockNumberData.blocks[date],
        );
      });
    });

    it("skips distributors with future creation dates entirely", async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const year = futureDate.getFullYear();
      const month = String(futureDate.getMonth() + 1).padStart(2, "0");
      const day = String(futureDate.getDate()).padStart(2, "0");
      const futureDateString = `${year}-${month}-${day}`;

      const distributorsWithFutureDate = {
        metadata: mockDistributorsData.metadata,
        distributors: {
          "0xFutureDistributor": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 9999999,
            date: futureDateString,
            tx_hash:
              "0x0000000000000000000000000000000000000000000000000000000000000000",
            method: "0xfcdde2b4",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: true,
            distributor_address: "0xFutureDistributor",
          },
        },
      };

      mockFileManager.readDistributors.mockReturnValue(
        distributorsWithFutureDate,
      );
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumberData);
      mockFileManager.readDistributorBalances.mockReturnValue(undefined);

      await fetcher.fetchBalances();

      // Should not fetch any balances for future distributors
      expect(mockProvider.getBalance).not.toHaveBeenCalled();
    });
  });

  describe("fetchBalances - filtering distributors", () => {
    let fetcher: BalanceFetcher;
    let mockDistributorsData: DistributorsData;

    beforeEach(() => {
      mockFileManager = {
        readDistributors: jest.fn(),
        readDistributorBalances: jest.fn(),
        writeDistributorBalances: jest.fn(),
        readBlockNumbers: jest.fn(),
      } as unknown as jest.Mocked<FileManager>;
      mockProvider = {} as jest.Mocked<ethers.Provider>;
      fetcher = new BalanceFetcher(mockFileManager, mockProvider);

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
          "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce": {
            type: DistributorType.L1_SURPLUS_FEE,
            block: 3163115,
            date: "2023-03-16",
            tx_hash:
              "0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0",
            method: "0x934be07d",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: true,
            distributor_address: "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce",
          },
        },
      };
    });

    it("filters to a specific distributor when distributorAddress is provided", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      const targetAddress = "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB";

      await fetcher.fetchBalances(targetAddress);

      expect(mockFileManager.readDistributors).toHaveBeenCalledTimes(1);
      // In the future, this test will verify that only the specified distributor is processed
      // For now, it just ensures the method completes without error
    });

    it("throws error when specified distributor is not found", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      const nonExistentAddress = "0x1234567890123456789012345678901234567890";

      await expect(fetcher.fetchBalances(nonExistentAddress)).rejects.toThrow(
        `Distributor not found: ${nonExistentAddress}`,
      );

      expect(mockFileManager.readDistributors).toHaveBeenCalledTimes(1);
    });
  });
});

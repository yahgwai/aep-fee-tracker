import { ethers } from "ethers";
import { FileManager } from "../../src/file-manager";
import { BalanceFetcher } from "../../src/balance-fetcher";
import { DistributorType } from "../../src/types";

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
  });
});

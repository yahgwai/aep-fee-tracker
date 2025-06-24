import { ethers } from "ethers";
import { FileManager } from "../../src/file-manager";
import { RecipientRecievedScanner } from "../../src/recipient-recieved-scanner";
import { DistributorType, DistributorsData } from "../../src/types";

jest.mock("../../src/file-manager");

describe("RecipientRecievedScanner", () => {
  let mockFileManager: jest.Mocked<FileManager>;
  let mockProvider: jest.Mocked<ethers.Provider>;

  beforeEach(() => {
    mockFileManager = {} as jest.Mocked<FileManager>;
    mockProvider = {} as jest.Mocked<ethers.Provider>;
  });

  describe("constructor", () => {
    it("can be instantiated with Provider and FileManager dependencies", () => {
      const scanner = new RecipientRecievedScanner(
        mockProvider,
        mockFileManager,
      );
      expect(scanner).toBeDefined();
      expect(scanner).toBeInstanceOf(RecipientRecievedScanner);
    });

    it("stores provider as readonly property", () => {
      const scanner = new RecipientRecievedScanner(
        mockProvider,
        mockFileManager,
      );
      expect(scanner.provider).toBe(mockProvider);
    });

    it("stores fileManager as readonly property", () => {
      const scanner = new RecipientRecievedScanner(
        mockProvider,
        mockFileManager,
      );
      expect(scanner.fileManager).toBe(mockFileManager);
    });
  });

  describe("scan", () => {
    let scanner: RecipientRecievedScanner;

    beforeEach(() => {
      scanner = new RecipientRecievedScanner(mockProvider, mockFileManager);
    });

    it("exists as a method on RecipientRecievedScanner instance", () => {
      expect(scanner.scan).toBeDefined();
      expect(typeof scanner.scan).toBe("function");
    });

    it("accepts optional distributorAddress parameter", () => {
      expect(scanner.scan.length).toBeLessThanOrEqual(1);
    });

    it("returns a Promise", () => {
      const result = scanner.scan();
      expect(result).toBeInstanceOf(Promise);
      result.catch(() => {}); // Prevent unhandled promise rejection
    });

    it("returns Promise<void>", async () => {
      const result = await scanner.scan();
      expect(result).toBeUndefined();
    });
  });

  describe("scan - address validation", () => {
    let scanner: RecipientRecievedScanner;

    beforeEach(() => {
      scanner = new RecipientRecievedScanner(mockProvider, mockFileManager);
    });

    it("accepts a valid Ethereum address without throwing", async () => {
      const validAddress = "0x1234567890123456789012345678901234567890";
      await expect(scanner.scan(validAddress)).resolves.not.toThrow();
    });

    it("throws error for invalid Ethereum address", async () => {
      const invalidAddress = "not-an-address";
      await expect(scanner.scan(invalidAddress)).rejects.toThrow(
        "Invalid Ethereum address: not-an-address",
      );
    });

    it("throws error for address with invalid checksum", async () => {
      const invalidChecksumAddress =
        "0x1234567890123456789012345678901234567890ABC";
      await expect(scanner.scan(invalidChecksumAddress)).rejects.toThrow(
        "Invalid Ethereum address: 0x1234567890123456789012345678901234567890ABC",
      );
    });

    it("works without distributorAddress parameter", async () => {
      await expect(scanner.scan()).resolves.not.toThrow();
    });

    it("works with undefined distributorAddress", async () => {
      await expect(scanner.scan(undefined)).resolves.not.toThrow();
    });
  });

  describe("scan - loading distributors", () => {
    let scanner: RecipientRecievedScanner;
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      mockFileManager = {
        readDistributors: jest.fn(),
      } as unknown as jest.Mocked<FileManager>;
      scanner = new RecipientRecievedScanner(mockProvider, mockFileManager);
      consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
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

      await scanner.scan();

      expect(mockFileManager.readDistributors).toHaveBeenCalledTimes(1);
    });

    it("returns early when no distributors are found in storage", async () => {
      mockFileManager.readDistributors.mockReturnValue(undefined);

      await scanner.scan();

      expect(mockFileManager.readDistributors).toHaveBeenCalledTimes(1);
      // Scanner should not proceed with any further operations
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

      await scanner.scan();

      expect(mockFileManager.readDistributors).toHaveBeenCalledTimes(1);
      // Scanner should not proceed with any further operations
    });
  });

  describe("scan - distributor filtering", () => {
    let scanner: RecipientRecievedScanner;
    let consoleLogSpy: jest.SpyInstance;
    let mockDistributorsData: DistributorsData;

    beforeEach(() => {
      mockFileManager = {
        readDistributors: jest.fn(),
      } as unknown as jest.Mocked<FileManager>;
      scanner = new RecipientRecievedScanner(mockProvider, mockFileManager);
      consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

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
          "0x7B065Fcb0760dF0CEA8CFd144e08554F3CeA73D1": {
            type: DistributorType.L1_BASE_FEE,
            block: 200,
            date: "2022-07-15",
            tx_hash:
              "0x5151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
            method: "0x57f585db",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: true,
            distributor_address: "0x7B065Fcb0760dF0CEA8CFd144e08554F3CeA73D1",
          },
        },
      };
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it("logs all distributors when no distributorAddress is provided", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);

      await scanner.scan();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Scanning all 2 distributors"),
      );
    });

    it("filters to a specific distributor when distributorAddress is provided", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      const targetAddress = "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB";

      await scanner.scan(targetAddress);

      expect(mockFileManager.readDistributors).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Scanning distributor: ${targetAddress}`),
      );
    });

    it("finds distributor with case-insensitive address comparison", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      const targetAddress = "0x37daa99b1caae0c22670963e103a66ca2c5db2db"; // lowercase

      await scanner.scan(targetAddress);

      expect(mockFileManager.readDistributors).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Scanning distributor:"),
      );
    });

    it("throws error when specified distributor is not found", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      const nonExistentAddress = "0x1234567890123456789012345678901234567890";

      await expect(scanner.scan(nonExistentAddress)).rejects.toThrow(
        `Distributor ${nonExistentAddress} not found`,
      );

      expect(mockFileManager.readDistributors).toHaveBeenCalledTimes(1);
    });
  });
});

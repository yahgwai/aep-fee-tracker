import { ethers } from "ethers";
import { FileManager } from "../../src/file-manager";
import { RecipientRecievedScanner } from "../../src/recipient-recieved-scanner";
import {
  DistributorType,
  DistributorsData,
  BlockNumberData,
} from "../../src/types";

jest.mock("../../src/file-manager");

describe("RecipientRecievedScanner", () => {
  let mockFileManager: jest.Mocked<FileManager>;
  let mockProvider: jest.Mocked<ethers.Provider>;

  beforeEach(() => {
    mockFileManager = {
      readDistributors: jest.fn(),
    } as unknown as jest.Mocked<FileManager>;
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
      mockFileManager = {
        readDistributors: jest.fn().mockReturnValue(undefined),
      } as unknown as jest.Mocked<FileManager>;
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

    beforeEach(() => {
      mockFileManager = {
        readDistributors: jest.fn(),
      } as unknown as jest.Mocked<FileManager>;
      scanner = new RecipientRecievedScanner(mockProvider, mockFileManager);
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
      mockFileManager.readBlockNumbers = jest.fn().mockReturnValue(undefined);

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

  describe("scan - loading block numbers", () => {
    let scanner: RecipientRecievedScanner;
    let mockDistributorsData: DistributorsData;

    beforeEach(() => {
      mockFileManager = {
        readDistributors: jest.fn(),
        readBlockNumbers: jest.fn(),
        readRecipientRecievedEvents: jest.fn(),
      } as unknown as jest.Mocked<FileManager>;
      scanner = new RecipientRecievedScanner(mockProvider, mockFileManager);

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

    it("loads block numbers data to determine date ranges", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue({
        metadata: { chain_id: 42170 },
        blocks: {
          "2022-07-11": 100,
          "2022-07-12": 200,
          "2022-07-13": 300,
        },
      });
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      await scanner.scan();

      expect(mockFileManager.readBlockNumbers).toHaveBeenCalledTimes(1);
    });

    it("returns early when no block numbers data is available", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(undefined);

      await scanner.scan();

      expect(mockFileManager.readBlockNumbers).toHaveBeenCalledTimes(1);
      // Scanner should not proceed with date range processing
    });
  });

  describe("scan - loading existing event data", () => {
    let scanner: RecipientRecievedScanner;
    let mockDistributorsData: DistributorsData;

    beforeEach(() => {
      mockFileManager = {
        readDistributors: jest.fn(),
        readBlockNumbers: jest.fn(),
        readRecipientRecievedEvents: jest.fn(),
      } as unknown as jest.Mocked<FileManager>;
      scanner = new RecipientRecievedScanner(mockProvider, mockFileManager);

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

    it("loads existing event data for each distributor", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue({
        metadata: { chain_id: 42170 },
        blocks: {
          "2022-07-11": 100,
          "2022-07-12": 200,
          "2022-07-13": 300,
        },
      });
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      await scanner.scan();

      expect(mockFileManager.readRecipientRecievedEvents).toHaveBeenCalledWith(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      );
    });

    it("loads existing event data for specific distributor when address provided", async () => {
      const targetAddress = "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB";
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue({
        metadata: { chain_id: 42170 },
        blocks: {
          "2022-07-11": 100,
          "2022-07-12": 200,
          "2022-07-13": 300,
        },
      });
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      await scanner.scan(targetAddress);

      expect(mockFileManager.readRecipientRecievedEvents).toHaveBeenCalledWith(
        targetAddress,
      );
      expect(mockFileManager.readRecipientRecievedEvents).toHaveBeenCalledTimes(
        1,
      );
    });
  });

  describe("scan - date range determination", () => {
    let scanner: RecipientRecievedScanner;
    let mockDistributorsData: DistributorsData;
    let mockBlockNumbersData: BlockNumberData;
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      mockFileManager = {
        readDistributors: jest.fn(),
        readBlockNumbers: jest.fn(),
        readRecipientRecievedEvents: jest.fn(),
      } as unknown as jest.Mocked<FileManager>;
      scanner = new RecipientRecievedScanner(mockProvider, mockFileManager);
      consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

      // Set up a mock date for "today" to make tests deterministic
      jest.useFakeTimers().setSystemTime(new Date("2022-07-15"));

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

      mockBlockNumbersData = {
        metadata: { chain_id: 42170 },
        blocks: {
          "2022-07-11": 100,
          "2022-07-12": 200,
          "2022-07-13": 300,
          "2022-07-14": 400,
        },
      };
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      jest.useRealTimers();
    });

    it("determines date range from creation date to yesterday when no existing data", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      await scanner.scan();

      // Should log the date range being processed
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("2022-07-12"), // creation date
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("2022-07-14"), // yesterday
      );
    });

    it("processes multiple distributors with different creation dates", async () => {
      const multipleDistributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
          last_scanned_block: 1000,
        },
        distributors: {
          "0x1111111111111111111111111111111111111111": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 100,
            date: "2022-07-10",
            tx_hash: "0x1111",
            method: "0xfcdde2b4",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: true,
            distributor_address: "0x1111111111111111111111111111111111111111",
          },
          "0x2222222222222222222222222222222222222222": {
            type: DistributorType.L1_BASE_FEE,
            block: 250,
            date: "2022-07-13",
            tx_hash: "0x2222",
            method: "0x57f585db",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: true,
            distributor_address: "0x2222222222222222222222222222222222222222",
          },
        },
      };

      mockFileManager.readDistributors.mockReturnValue(
        multipleDistributorsData,
      );
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      await scanner.scan();

      // Should have logged date ranges for both distributors
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("0x1111111111111111111111111111111111111111"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("2022-07-10"), // first distributor creation
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("0x2222222222222222222222222222222222222222"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("2022-07-13"), // second distributor creation
      );
    });

    it("determines date range from day after last scanned block when existing data present", async () => {
      const existingEventData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          last_scanned_block: 200, // Block 200 is on 2022-07-12
        },
        events: {
          "0xabc123:0": {
            blockNumber: 200,
            transactionHash: "0xabc123",
            logIndex: 0,
            address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
            topics: ["0x..."],
            data: "0x...",
            recipient: "0x1234567890123456789012345678901234567890",
            value: "1000000000000000000",
          },
        },
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(
        existingEventData,
      );

      await scanner.scan();

      // Should log date range starting from day after last scanned block
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("2022-07-13"), // day after 2022-07-12
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("2022-07-14"), // yesterday
      );
    });

    it("correctly handles existing data with last scanned block on different dates", async () => {
      const existingEventData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          last_scanned_block: 300, // Block 300 is on 2022-07-13
        },
        events: {},
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(
        existingEventData,
      );

      await scanner.scan();

      // Should log date range starting from day after last scanned block
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("2022-07-14"), // day after 2022-07-13
      );
    });

    it("skips distributors when all dates have been processed", async () => {
      const existingEventData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          last_scanned_block: 400, // Block 400 is on 2022-07-14 (yesterday)
        },
        events: {},
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(
        existingEventData,
      );

      await scanner.scan();

      // Should log that distributor is being skipped
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Skipping"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("no new dates"),
      );
    });

    it("correctly calculates yesterday as the end date", async () => {
      // Today is 2022-07-15, so yesterday should be 2022-07-14
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      await scanner.scan();

      // Should not process beyond yesterday
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("2022-07-15"), // today
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("2022-07-14"), // yesterday
      );
    });

    it("handles future distributors gracefully", async () => {
      const futureDistributorData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
          last_scanned_block: 1000,
        },
        distributors: {
          "0x9999999999999999999999999999999999999999": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 500,
            date: "2022-07-16", // Created in the future (tomorrow)
            tx_hash: "0x9999",
            method: "0xfcdde2b4",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: true,
            distributor_address: "0x9999999999999999999999999999999999999999",
          },
        },
      };

      mockFileManager.readDistributors.mockReturnValue(futureDistributorData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      await scanner.scan();

      // Should skip future distributor
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Skipping"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("0x9999999999999999999999999999999999999999"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("future"),
      );
    });

    it("logs the complete date range for each distributor being processed", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      await scanner.scan();

      // Should log processing info with date range
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(
          /Processing.*0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB.*from 2022-07-12 to 2022-07-14/,
        ),
      );
    });
  });

  describe("scan - distributor filtering", () => {
    let scanner: RecipientRecievedScanner;
    let mockDistributorsData: DistributorsData;

    beforeEach(() => {
      mockFileManager = {
        readDistributors: jest.fn(),
        readBlockNumbers: jest.fn(),
        readRecipientRecievedEvents: jest.fn(),
      } as unknown as jest.Mocked<FileManager>;
      scanner = new RecipientRecievedScanner(mockProvider, mockFileManager);

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

    it("processes all distributors when no distributorAddress is provided", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(undefined);

      await scanner.scan();

      expect(mockFileManager.readDistributors).toHaveBeenCalledTimes(1);
      // Scanner will process all distributors
    });

    it("filters to a specific distributor when distributorAddress is provided", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(undefined);
      const targetAddress = "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB";

      await scanner.scan(targetAddress);

      expect(mockFileManager.readDistributors).toHaveBeenCalledTimes(1);
      // Scanner will process only the specified distributor
    });

    it("finds distributor with case-insensitive address comparison", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(undefined);
      const targetAddress = "0x37daa99b1caae0c22670963e103a66ca2c5db2db"; // lowercase

      await scanner.scan(targetAddress);

      expect(mockFileManager.readDistributors).toHaveBeenCalledTimes(1);
      // Scanner should find the distributor despite case mismatch
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

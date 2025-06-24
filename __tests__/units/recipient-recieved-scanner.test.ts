import { ethers } from "ethers";
import { FileManager } from "../../src/file-manager";
import {
  RecipientRecievedScanner,
  RECIPIENT_RECIEVED_EVENT_SIGNATURE,
  RECIPIENT_RECIEVED_EVENT_TOPIC,
  RECIPIENT_RECIEVED_EVENT_ABI,
  recipientRecievedInterface,
} from "../../src/recipient-recieved-scanner";
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
    mockProvider = {
      getLogs: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ethers.Provider>;
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
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("loads block numbers data to determine date ranges", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue({
        metadata: { chain_id: 42170 },
        blocks: {
          "2022-07-11": 100,
          "2022-07-12": 200,
          "2022-07-13": 300,
          "2022-07-14": 400,
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
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("loads existing event data for each distributor", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue({
        metadata: { chain_id: 42170 },
        blocks: {
          "2022-07-11": 100,
          "2022-07-12": 200,
          "2022-07-13": 300,
          "2022-07-14": 400,
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
          "2022-07-14": 400,
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

    beforeEach(() => {
      mockFileManager = {
        readDistributors: jest.fn(),
        readBlockNumbers: jest.fn(),
        readRecipientRecievedEvents: jest.fn(),
      } as unknown as jest.Mocked<FileManager>;
      scanner = new RecipientRecievedScanner(mockProvider, mockFileManager);

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
          "2022-07-10": 50,
          "2022-07-11": 100,
          "2022-07-12": 200,
          "2022-07-13": 300,
          "2022-07-14": 400,
        },
      };
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("determines date range from creation date to yesterday when no existing data", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      // Should complete without error
      await expect(scanner.scan()).resolves.not.toThrow();
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

      // Should process both distributors without error
      await expect(scanner.scan()).resolves.not.toThrow();
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

      // Should process without error, starting from day after last scanned block
      await expect(scanner.scan()).resolves.not.toThrow();
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

      // Should process without error
      await expect(scanner.scan()).resolves.not.toThrow();
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

      // Should complete without error, skipping the distributor
      await expect(scanner.scan()).resolves.not.toThrow();
    });

    it("correctly calculates yesterday as the end date", async () => {
      // Today is 2022-07-15, so yesterday should be 2022-07-14
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      // Should process dates up to yesterday without error
      await expect(scanner.scan()).resolves.not.toThrow();
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

      // Should skip future distributors without error
      await expect(scanner.scan()).resolves.not.toThrow();
    });

    it("processes date ranges for each distributor", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      // Should process date ranges without error
      await expect(scanner.scan()).resolves.not.toThrow();
    });

    it("throws error when cannot find date for last scanned block", async () => {
      const existingEventData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          last_scanned_block: 999, // Block that doesn't exist in our block numbers data
        },
        events: {},
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(
        existingEventData,
      );

      await expect(scanner.scan()).rejects.toThrow(
        "Cannot find date for block 999 for distributor 0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
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

  describe("scan - block number conversion", () => {
    let scanner: RecipientRecievedScanner;
    let mockDistributorsData: DistributorsData;
    let mockBlockNumbersData: BlockNumberData;

    beforeEach(() => {
      mockFileManager = {
        readDistributors: jest.fn(),
        readBlockNumbers: jest.fn(),
        readRecipientRecievedEvents: jest.fn(),
      } as unknown as jest.Mocked<FileManager>;
      scanner = new RecipientRecievedScanner(mockProvider, mockFileManager);

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
          "2022-07-10": 50,
          "2022-07-11": 100,
          "2022-07-12": 200,
          "2022-07-13": 300,
          "2022-07-14": 400,
        },
      };
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("converts each date in the range to block numbers", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      const scannerWithSpy = new RecipientRecievedScanner(
        mockProvider,
        mockFileManager,
      );
      const convertDateToBlockRangeSpy = jest.spyOn(
        scannerWithSpy as unknown as { convertDateToBlockRange: jest.Mock },
        "convertDateToBlockRange",
      );

      await scannerWithSpy.scan();

      // Should convert dates 2022-07-12, 2022-07-13, and 2022-07-14
      expect(convertDateToBlockRangeSpy).toHaveBeenCalledWith(
        "2022-07-12",
        mockBlockNumbersData,
      );
      expect(convertDateToBlockRangeSpy).toHaveBeenCalledWith(
        "2022-07-13",
        mockBlockNumbersData,
      );
      expect(convertDateToBlockRangeSpy).toHaveBeenCalledWith(
        "2022-07-14",
        mockBlockNumbersData,
      );
      expect(convertDateToBlockRangeSpy).toHaveBeenCalledTimes(3);
    });

    it("creates block ranges with start and end blocks for each date", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      const scannerWithSpy = new RecipientRecievedScanner(
        mockProvider,
        mockFileManager,
      );
      const convertDateToBlockRangeSpy = jest.spyOn(
        scannerWithSpy as unknown as { convertDateToBlockRange: jest.Mock },
        "convertDateToBlockRange",
      );

      await scannerWithSpy.scan();

      // Check that the method returns correct block ranges
      expect(convertDateToBlockRangeSpy).toHaveReturnedWith({
        startBlock: 101, // Previous day's end block + 1
        endBlock: 200,
      });
      expect(convertDateToBlockRangeSpy).toHaveReturnedWith({
        startBlock: 201,
        endBlock: 300,
      });
      expect(convertDateToBlockRangeSpy).toHaveReturnedWith({
        startBlock: 301,
        endBlock: 400,
      });
    });

    it("throws error when block number is missing for a date", async () => {
      const distributor =
        mockDistributorsData.distributors[
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"
        ];
      if (distributor) {
        distributor.date = "2022-07-09"; // Date before available block data
      }

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      await expect(scanner.scan()).rejects.toThrow(
        "Missing block number for date 2022-07-09 for distributor 0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      );
    });

    it("validates all required block numbers before processing", async () => {
      // Add a gap in block numbers
      delete mockBlockNumbersData.blocks["2022-07-13"];

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      await expect(scanner.scan()).rejects.toThrow(
        "Missing block number for date 2022-07-13 for distributor 0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      );
    });

    it("handles first date in block data correctly", async () => {
      // Set distributor to start from the first date in block data
      const distributor =
        mockDistributorsData.distributors[
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB"
        ];
      if (distributor) {
        distributor.date = "2022-07-10";
      }

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      const scannerWithSpy = new RecipientRecievedScanner(
        mockProvider,
        mockFileManager,
      );
      const convertDateToBlockRangeSpy = jest.spyOn(
        scannerWithSpy as unknown as { convertDateToBlockRange: jest.Mock },
        "convertDateToBlockRange",
      );

      await scannerWithSpy.scan();

      // First date should start from block 1
      expect(convertDateToBlockRangeSpy).toHaveBeenNthCalledWith(
        1,
        "2022-07-10",
        mockBlockNumbersData,
      );
      expect(convertDateToBlockRangeSpy).toHaveNthReturnedWith(1, {
        startBlock: 1, // No previous day, so start from block 1
        endBlock: 50,
      });
    });

    it("processes block ranges for multiple distributors", async () => {
      // Add another distributor
      mockDistributorsData.distributors[
        "0x1234567890123456789012345678901234567890"
      ] = {
        type: DistributorType.L1_BASE_FEE,
        block: 250,
        date: "2022-07-13",
        tx_hash: "0xabc",
        method: "0x57f585db",
        owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
        event_data: "0x...",
        is_reward_distributor: true,
        distributor_address: "0x1234567890123456789012345678901234567890",
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      const scannerWithSpy = new RecipientRecievedScanner(
        mockProvider,
        mockFileManager,
      );
      const convertDateToBlockRangeSpy = jest.spyOn(
        scannerWithSpy as unknown as { convertDateToBlockRange: jest.Mock },
        "convertDateToBlockRange",
      );

      await scannerWithSpy.scan();

      // Should convert dates for both distributors
      expect(convertDateToBlockRangeSpy).toHaveBeenCalledTimes(5); // 3 dates for first + 2 dates for second
    });
  });

  describe("RecipientRecieved event constants", () => {
    it("defines RECIPIENT_RECIEVED_EVENT_SIGNATURE with correct format", () => {
      expect(RECIPIENT_RECIEVED_EVENT_SIGNATURE).toBeDefined();
      expect(RECIPIENT_RECIEVED_EVENT_SIGNATURE).toBe(
        "RecipientRecieved(address,uint256)",
      );
    });

    it("defines RECIPIENT_RECIEVED_EVENT_TOPIC as the keccak256 hash of the signature", () => {
      expect(RECIPIENT_RECIEVED_EVENT_TOPIC).toBeDefined();

      // Calculate expected hash
      const expectedHash = ethers.id("RecipientRecieved(address,uint256)");
      expect(RECIPIENT_RECIEVED_EVENT_TOPIC).toBe(expectedHash);
    });

    it("event topic is a valid hex string", () => {
      expect(RECIPIENT_RECIEVED_EVENT_TOPIC).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
  });

  describe("RecipientRecieved event interface", () => {
    it("defines RECIPIENT_RECIEVED_EVENT_ABI with correct event definition", () => {
      expect(RECIPIENT_RECIEVED_EVENT_ABI).toBeDefined();
      expect(RECIPIENT_RECIEVED_EVENT_ABI).toContain(
        "event RecipientRecieved(address indexed recipient, uint256 value)",
      );
    });

    it("creates recipientRecievedInterface as an ethers Interface", () => {
      expect(recipientRecievedInterface).toBeDefined();
      expect(recipientRecievedInterface).toBeInstanceOf(ethers.Interface);
    });

    it("interface contains RecipientRecieved event", () => {
      const event = recipientRecievedInterface.getEvent("RecipientRecieved");
      expect(event).toBeDefined();
      expect(event!.name).toBe("RecipientRecieved");
    });

    it("RecipientRecieved event has correct inputs", () => {
      const event = recipientRecievedInterface.getEvent("RecipientRecieved");
      expect(event!.inputs).toHaveLength(2);

      // Check recipient parameter
      expect(event!.inputs[0]!.name).toBe("recipient");
      expect(event!.inputs[0]!.type).toBe("address");
      expect(event!.inputs[0]!.indexed).toBe(true);

      // Check value parameter
      expect(event!.inputs[1]!.name).toBe("value");
      expect(event!.inputs[1]!.type).toBe("uint256");
      expect(event!.inputs[1]!.indexed).toBeFalsy(); // Could be false or null
    });

    it("interface generates correct event topic", () => {
      const eventFragment =
        recipientRecievedInterface.getEvent("RecipientRecieved");
      const topicHash = ethers.id(eventFragment!.format("sighash"));
      expect(topicHash).toBe(RECIPIENT_RECIEVED_EVENT_TOPIC);
    });
  });

  describe("queryRecipientRecievedEvents", () => {
    let scanner: RecipientRecievedScanner;
    let mockProvider: jest.Mocked<ethers.Provider>;

    beforeEach(() => {
      jest.clearAllMocks();
      mockFileManager = {} as jest.Mocked<FileManager>;
      mockProvider = {
        getLogs: jest.fn(),
      } as unknown as jest.Mocked<ethers.Provider>;
      scanner = new RecipientRecievedScanner(mockProvider, mockFileManager);
    });

    it("exists as a method on RecipientRecievedScanner instance", () => {
      expect(scanner.queryRecipientRecievedEvents).toBeDefined();
      expect(typeof scanner.queryRecipientRecievedEvents).toBe("function");
    });

    it("returns a Promise of ethers.Log array", async () => {
      const distributorAddress = "0x1234567890123456789012345678901234567890";
      mockProvider.getLogs.mockResolvedValue([]);

      const result = scanner.queryRecipientRecievedEvents(
        distributorAddress,
        1,
        100,
      );
      expect(result).toBeInstanceOf(Promise);

      const logs = await result;
      expect(Array.isArray(logs)).toBe(true);
    });

    it("chunks large block ranges into 10000 block chunks", async () => {
      const distributorAddress = "0x1234567890123456789012345678901234567890";
      mockProvider.getLogs.mockResolvedValue([]);

      await scanner.queryRecipientRecievedEvents(distributorAddress, 1, 25000);

      // Should be called 3 times for ranges 1-10000, 10001-20000, 20001-25000
      expect(mockProvider.getLogs).toHaveBeenCalledTimes(3);

      expect(mockProvider.getLogs).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          fromBlock: 1,
          toBlock: 10000,
        }),
      );

      expect(mockProvider.getLogs).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          fromBlock: 10001,
          toBlock: 20000,
        }),
      );

      expect(mockProvider.getLogs).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          fromBlock: 20001,
          toBlock: 25000,
        }),
      );
    });

    it("queries events with correct filter parameters", async () => {
      const distributorAddress = "0x1234567890123456789012345678901234567890";
      mockProvider.getLogs.mockResolvedValue([]);

      await scanner.queryRecipientRecievedEvents(distributorAddress, 100, 200);

      expect(mockProvider.getLogs).toHaveBeenCalledWith({
        address: distributorAddress,
        topics: [RECIPIENT_RECIEVED_EVENT_TOPIC],
        fromBlock: 100,
        toBlock: 200,
      });
    });

    it("returns all logs from multiple chunks", async () => {
      const distributorAddress = "0x1234567890123456789012345678901234567890";
      const mockLogs1 = [
        { blockNumber: 5000, transactionHash: "0x111", index: 0 },
        { blockNumber: 8000, transactionHash: "0x222", index: 1 },
      ] as unknown as ethers.Log[];
      const mockLogs2 = [
        { blockNumber: 15000, transactionHash: "0x333", index: 0 },
      ] as unknown as ethers.Log[];

      mockProvider.getLogs
        .mockResolvedValueOnce(mockLogs1)
        .mockResolvedValueOnce(mockLogs2);

      const result = await scanner.queryRecipientRecievedEvents(
        distributorAddress,
        1,
        20000,
      );

      expect(result).toHaveLength(3);
      expect(result).toEqual([...mockLogs1, ...mockLogs2]);
    });

    it("handles empty results", async () => {
      const distributorAddress = "0x1234567890123456789012345678901234567890";
      mockProvider.getLogs.mockResolvedValue([]);

      const result = await scanner.queryRecipientRecievedEvents(
        distributorAddress,
        1,
        100,
      );

      expect(result).toEqual([]);
    });

    it("applies retry logic when RPC calls fail", async () => {
      const distributorAddress = "0x1234567890123456789012345678901234567890";
      const mockError = new Error("RPC error");

      // Fail twice, then succeed
      mockProvider.getLogs
        .mockRejectedValueOnce(mockError)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce([]);

      const result = await scanner.queryRecipientRecievedEvents(
        distributorAddress,
        1,
        100,
      );

      expect(result).toEqual([]);
      expect(mockProvider.getLogs).toHaveBeenCalledTimes(3);
    });

    it("throws error after max retries", async () => {
      const distributorAddress = "0x1234567890123456789012345678901234567890";
      const mockError = new Error("RPC error");

      // Always fail
      mockProvider.getLogs.mockRejectedValue(mockError);

      await expect(
        scanner.queryRecipientRecievedEvents(distributorAddress, 1, 100),
      ).rejects.toThrow("RPC error");
    });

    it("processes multiple chunks even if some chunks have no events", async () => {
      const distributorAddress = "0x1234567890123456789012345678901234567890";
      const mockLogs = [
        { blockNumber: 15000, transactionHash: "0x123", index: 0 },
      ] as unknown as ethers.Log[];

      mockProvider.getLogs
        .mockResolvedValueOnce([]) // First chunk empty
        .mockResolvedValueOnce(mockLogs) // Second chunk has events
        .mockResolvedValueOnce([]); // Third chunk empty

      const result = await scanner.queryRecipientRecievedEvents(
        distributorAddress,
        1,
        25000,
      );

      expect(result).toEqual(mockLogs);
      expect(mockProvider.getLogs).toHaveBeenCalledTimes(3);
    });
  });

  describe("scan - event querying integration", () => {
    let scanner: RecipientRecievedScanner;
    let mockDistributorsData: DistributorsData;
    let mockBlockNumbersData: BlockNumberData;

    beforeEach(() => {
      jest.clearAllMocks();
      mockFileManager = {
        readDistributors: jest.fn(),
        readBlockNumbers: jest.fn(),
        readRecipientRecievedEvents: jest.fn(),
      } as unknown as jest.Mocked<FileManager>;
      mockProvider = {
        getLogs: jest.fn(),
      } as unknown as jest.Mocked<ethers.Provider>;
      scanner = new RecipientRecievedScanner(mockProvider, mockFileManager);

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
      jest.useRealTimers();
    });

    it("queries RecipientRecieved events for each date range", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);
      mockProvider.getLogs.mockResolvedValue([]);

      await scanner.scan();

      // Should query events for each day from creation date to yesterday
      // Day 1: 2022-07-12 (blocks 101-200)
      expect(mockProvider.getLogs).toHaveBeenCalledWith({
        address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        topics: [RECIPIENT_RECIEVED_EVENT_TOPIC],
        fromBlock: 101,
        toBlock: 200,
      });

      // Day 2: 2022-07-13 (blocks 201-300)
      expect(mockProvider.getLogs).toHaveBeenCalledWith({
        address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        topics: [RECIPIENT_RECIEVED_EVENT_TOPIC],
        fromBlock: 201,
        toBlock: 300,
      });

      // Day 3: 2022-07-14 (blocks 301-400)
      expect(mockProvider.getLogs).toHaveBeenCalledWith({
        address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        topics: [RECIPIENT_RECIEVED_EVENT_TOPIC],
        fromBlock: 301,
        toBlock: 400,
      });

      expect(mockProvider.getLogs).toHaveBeenCalledTimes(3);
    });

    it("collects all events across multiple days", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      const mockLogs1 = [
        { blockNumber: 150, transactionHash: "0x111", index: 0 },
      ] as unknown as ethers.Log[];
      const mockLogs2 = [
        { blockNumber: 250, transactionHash: "0x222", index: 0 },
        { blockNumber: 280, transactionHash: "0x333", index: 1 },
      ] as unknown as ethers.Log[];
      const mockLogs3 = [
        { blockNumber: 350, transactionHash: "0x444", index: 0 },
      ] as unknown as ethers.Log[];

      mockProvider.getLogs
        .mockResolvedValueOnce(mockLogs1)
        .mockResolvedValueOnce(mockLogs2)
        .mockResolvedValueOnce(mockLogs3);

      await scanner.scan();

      // Verify all logs were queried
      expect(mockProvider.getLogs).toHaveBeenCalledTimes(3);

      // Should have queried in chronological order
      expect(mockProvider.getLogs).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          fromBlock: 101,
          toBlock: 200,
        }),
      );
      expect(mockProvider.getLogs).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          fromBlock: 201,
          toBlock: 300,
        }),
      );
      expect(mockProvider.getLogs).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          fromBlock: 301,
          toBlock: 400,
        }),
      );
    });

    it("does not parse or store events during scan", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);
      mockFileManager.writeRecipientRecievedEvents = jest.fn();

      const mockLogs = [
        {
          blockNumber: 150,
          transactionHash: "0x111",
          index: 0,
          topics: [RECIPIENT_RECIEVED_EVENT_TOPIC, "0xrecipient"],
          data: "0xvalue",
        },
      ] as unknown as ethers.Log[];

      mockProvider.getLogs.mockResolvedValue(mockLogs);

      await scanner.scan();

      // Should NOT write events to disk (out of scope)
      expect(
        mockFileManager.writeRecipientRecievedEvents,
      ).not.toHaveBeenCalled();

      // Should NOT access the interface for parsing (out of scope)
      const interfaceSpy = jest.spyOn(recipientRecievedInterface, "parseLog");
      expect(interfaceSpy).not.toHaveBeenCalled();
    });

    it("handles empty event results for some date ranges", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      mockProvider.getLogs
        .mockResolvedValueOnce([]) // Day 1: no events
        .mockResolvedValueOnce([
          { blockNumber: 250, transactionHash: "0x222", index: 0 },
        ] as unknown as ethers.Log[]) // Day 2: has events
        .mockResolvedValueOnce([]); // Day 3: no events

      await scanner.scan();

      expect(mockProvider.getLogs).toHaveBeenCalledTimes(3);
    });

    it("skips event querying when all dates have been processed", async () => {
      const existingEventData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          last_scanned_block: 400, // Already scanned up to yesterday
        },
        events: {},
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(
        existingEventData,
      );

      await scanner.scan();

      // Should not query any events since already up to date
      expect(mockProvider.getLogs).not.toHaveBeenCalled();
    });

    it("queries events only for dates after last scanned block", async () => {
      const existingEventData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          last_scanned_block: 200, // Scanned up to 2022-07-12
        },
        events: {},
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(
        existingEventData,
      );
      mockProvider.getLogs.mockResolvedValue([]);

      await scanner.scan();

      // Should only query events for 2022-07-13 and 2022-07-14
      expect(mockProvider.getLogs).toHaveBeenCalledTimes(2);
      expect(mockProvider.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          fromBlock: 201,
          toBlock: 300,
        }),
      );
      expect(mockProvider.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          fromBlock: 301,
          toBlock: 400,
        }),
      );
    });

    it("handles large block ranges by chunking", async () => {
      // Set up a scenario with a large block range
      const largeRangeBlockData = {
        metadata: { chain_id: 42170 },
        blocks: {
          "2022-07-11": 100,
          "2022-07-12": 25000, // Large range that needs chunking
          "2022-07-13": 25100, // Add the next day to avoid missing block error
          "2022-07-14": 25200, // Add up to yesterday
        },
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(largeRangeBlockData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);
      mockProvider.getLogs.mockResolvedValue([]);

      await scanner.scan();

      // Should chunk the large range (101-25000) into multiple calls
      const logsCallsForLargeRange = mockProvider.getLogs.mock.calls.filter(
        (call) => {
          const filter = call[0] as { fromBlock?: number; toBlock?: number };
          return (
            filter.fromBlock !== undefined &&
            filter.toBlock !== undefined &&
            filter.fromBlock >= 101 &&
            filter.toBlock <= 25000
          );
        },
      );
      expect(logsCallsForLargeRange.length).toBeGreaterThan(1);

      // Verify first chunk of the large range
      expect(mockProvider.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          fromBlock: 101,
          toBlock: 10100,
        }),
      );
    });
  });
});

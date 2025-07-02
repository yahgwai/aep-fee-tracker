import { ethers } from "ethers";
import { FileManager } from "../../../../src/infrastructure/storage/file-manager";
import {
  RecipientRecievedScanner,
  RECIPIENT_RECIEVED_EVENT_SIGNATURE,
  RECIPIENT_RECIEVED_EVENT_TOPIC,
  RECIPIENT_RECIEVED_EVENT_ABI,
  recipientRecievedInterface,
} from "../../../../src/core/fee-calculation/recipient-recieved-scanner";
import {
  DistributorType,
  DistributorsData,
  BlockNumberData,
} from "../../../../src/types";

jest.mock("../../../../src/infrastructure/storage/file-manager");

// Helper function to create a properly mocked FileManager
function createMockFileManager(
  overrides?: Partial<jest.Mocked<FileManager>>,
): jest.Mocked<FileManager> {
  const mock = {
    readDistributors: jest.fn(),
    writeDistributors: jest.fn(),
    readBlockNumbers: jest.fn(),
    writeBlockNumbers: jest.fn(),
    readDistributorBalances: jest.fn(),
    writeDistributorBalances: jest.fn(),
    readRecipientRecievedEvents: jest.fn(),
    writeRecipientRecievedEvents: jest.fn(),
    readFeeReport: jest.fn(),
    writeFeeReport: jest.fn(),
    ensureStoreDirectory: jest.fn(),
    validateAddress: jest.fn((address: string) => address),
    formatDate: jest.fn((date: Date) => date.toISOString().split("T")[0]),
    validateDateFormat: jest.fn(),
    validateBlockNumber: jest.fn(),
    validateWeiValue: jest.fn(),
    validateTransactionHash: jest.fn(),
    validateEnumValue: jest.fn(),
    getMaxDate: jest.fn(() => {
      // Calculate from block numbers
      const data = mock.readBlockNumbers();
      if (!data || !data.blocks) {
        return null;
      }
      const dates = Object.keys(data.blocks).sort();
      if (dates.length === 0) {
        return null;
      }
      const maxDate = dates[dates.length - 1];
      return maxDate ? new Date(maxDate) : null;
    }),
    getMinDate: jest.fn(() => {
      // Calculate from block numbers
      const data = mock.readBlockNumbers();
      if (!data || !data.blocks) {
        return null;
      }
      const dates = Object.keys(data.blocks).sort();
      if (dates.length === 0) {
        return null;
      }
      const minDate = dates[0];
      return minDate ? new Date(minDate) : null;
    }),
    ...overrides,
  } as unknown as jest.Mocked<FileManager>;

  return mock;
}

describe("RecipientRecievedScanner", () => {
  let mockFileManager: jest.Mocked<FileManager>;
  let mockProvider: jest.Mocked<ethers.Provider>;

  beforeEach(() => {
    mockFileManager = createMockFileManager();
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
      mockFileManager = createMockFileManager({
        readDistributors: jest.fn().mockReturnValue(undefined),
        writeRecipientRecievedEvents: jest.fn(),
      });
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
      mockFileManager = createMockFileManager();
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
      mockFileManager = createMockFileManager();
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

      // readBlockNumbers is called twice: once directly by scan() and once by getMaxDate()
      expect(mockFileManager.readBlockNumbers).toHaveBeenCalledTimes(2);
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
      mockFileManager = createMockFileManager();
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
      mockFileManager.writeRecipientRecievedEvents = jest.fn();
      mockProvider.getLogs.mockResolvedValue([]);

      await scanner.scan(targetAddress);

      expect(mockFileManager.readRecipientRecievedEvents).toHaveBeenCalledWith(
        targetAddress,
      );
      // readRecipientRecievedEvents is called multiple times during event processing
      expect(mockFileManager.readRecipientRecievedEvents).toHaveBeenCalled();
    });
  });

  describe("scan - date range determination", () => {
    let scanner: RecipientRecievedScanner;
    let mockDistributorsData: DistributorsData;
    let mockBlockNumbersData: BlockNumberData;

    beforeEach(() => {
      mockFileManager = createMockFileManager();
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
      mockFileManager.writeRecipientRecievedEvents = jest.fn();
      mockProvider.getLogs.mockResolvedValue([]);

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
      mockFileManager.writeRecipientRecievedEvents = jest.fn();
      mockProvider.getLogs.mockResolvedValue([]);

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

    it("uses max date from block store instead of calculating yesterday", async () => {
      // Set up block numbers data that ends at 2022-05-02 (much earlier than "today")
      const historicalBlockNumbersData: BlockNumberData = {
        metadata: { chain_id: 42170 },
        blocks: {
          "2022-05-01": 100,
          "2022-05-02": 200, // Max date in store
        },
      };

      // Distributor created on 2022-05-01
      const historicalDistributorsData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
          last_scanned_block: 1000,
        },
        distributors: {
          "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 100,
            date: "2022-05-01",
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

      mockFileManager.readDistributors.mockReturnValue(
        historicalDistributorsData,
      );
      mockFileManager.readBlockNumbers.mockReturnValue(
        historicalBlockNumbersData,
      );
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);
      mockProvider.getLogs.mockResolvedValue([]);

      await scanner.scan();

      // Verify it queried for blocks up to 2022-05-02 (store max), not yesterday (2022-07-14)
      expect(mockProvider.getLogs).toHaveBeenCalledWith({
        address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        topics: [RECIPIENT_RECIEVED_EVENT_TOPIC],
        fromBlock: 101, // Day after creation
        toBlock: 200, // Max block in store
      });

      // Verify no calls were made for dates beyond the store
      const allCalls = mockProvider.getLogs.mock.calls;
      const maxBlockQueried = Math.max(
        ...allCalls.map((call) => {
          const filter = call[0] as { toBlock: number };
          return filter.toBlock;
        }),
      );
      expect(maxBlockQueried).toBe(200); // Should not exceed max block in store
    });

    it("respects block store boundaries when processing distributors", async () => {
      // Set up block numbers data with limited range
      const limitedBlockNumbersData: BlockNumberData = {
        metadata: { chain_id: 42170 },
        blocks: {
          "2022-05-01": 100,
          "2022-05-02": 200,
          "2022-05-03": 300, // Only 3 days of data
        },
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(limitedBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);
      mockProvider.getLogs.mockResolvedValue([]);

      await scanner.scan();

      // Even though distributor was created on 2022-07-12, it should not process
      // because that date is not in the block store
      expect(mockProvider.getLogs).not.toHaveBeenCalled();
    });

    it("handles missing block numbers gracefully without querying", async () => {
      // Set up block numbers data with gaps
      const gappedBlockNumbersData: BlockNumberData = {
        metadata: { chain_id: 42170 },
        blocks: {
          "2022-07-12": 200, // Creation date
          "2022-07-14": 400, // Missing 2022-07-13
        },
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(gappedBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);
      mockProvider.getLogs.mockResolvedValue([]);

      await scanner.scan();

      // Should query for 2022-07-12 and 2022-07-14, but not fail on missing 2022-07-13
      expect(mockProvider.getLogs).toHaveBeenCalledTimes(2);
      expect(mockProvider.getLogs).toHaveBeenCalledWith({
        address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        topics: [RECIPIENT_RECIEVED_EVENT_TOPIC],
        fromBlock: 1, // No previous day, so starts at 1
        toBlock: 200,
      });
      expect(mockProvider.getLogs).toHaveBeenCalledWith({
        address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        topics: [RECIPIENT_RECIEVED_EVENT_TOPIC],
        fromBlock: 201,
        toBlock: 400,
      });
    });
  });

  describe("scan - distributor filtering", () => {
    let scanner: RecipientRecievedScanner;
    let mockDistributorsData: DistributorsData;

    beforeEach(() => {
      mockFileManager = createMockFileManager();
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
      mockFileManager = createMockFileManager();
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

    it("skips dates when block number is missing", async () => {
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
      mockProvider.getLogs.mockResolvedValue([]);

      // Should not throw error, should skip the missing date
      await expect(scanner.scan()).resolves.not.toThrow();

      // Verify it only queried for available dates
      expect(mockProvider.getLogs).toHaveBeenCalled();
    });

    it("skips missing block numbers during processing", async () => {
      // Add a gap in block numbers
      delete mockBlockNumbersData.blocks["2022-07-13"];

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);
      mockProvider.getLogs.mockResolvedValue([]);

      // Should not throw error, should skip the missing date
      await expect(scanner.scan()).resolves.not.toThrow();

      // Verify it queried for available dates only
      const calls = mockProvider.getLogs.mock.calls;
      const queriedDates = calls.map((call) => {
        const filter = call[0] as { toBlock: number };
        return filter.toBlock;
      });

      // Should not have queried for block 300 (2022-07-13)
      expect(queriedDates).not.toContain(300);
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
      mockFileManager = createMockFileManager();
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
      mockFileManager = createMockFileManager();
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
      mockFileManager.writeRecipientRecievedEvents = jest.fn();

      const mockLogs1 = [
        {
          blockNumber: 150,
          transactionHash: "0x111",
          index: 0,
          address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          topics: [
            RECIPIENT_RECIEVED_EVENT_TOPIC,
            ethers.zeroPadValue(
              "0x1111111111111111111111111111111111111111",
              32,
            ),
          ],
          data: ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256"],
            ["1000000000000000000"],
          ),
        },
      ] as unknown as ethers.Log[];
      const mockLogs2 = [
        {
          blockNumber: 250,
          transactionHash: "0x222",
          index: 0,
          address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          topics: [
            RECIPIENT_RECIEVED_EVENT_TOPIC,
            ethers.zeroPadValue(
              "0x2222222222222222222222222222222222222222",
              32,
            ),
          ],
          data: ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256"],
            ["2000000000000000000"],
          ),
        },
        {
          blockNumber: 280,
          transactionHash: "0x333",
          index: 1,
          address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          topics: [
            RECIPIENT_RECIEVED_EVENT_TOPIC,
            ethers.zeroPadValue(
              "0x3333333333333333333333333333333333333333",
              32,
            ),
          ],
          data: ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256"],
            ["3000000000000000000"],
          ),
        },
      ] as unknown as ethers.Log[];
      const mockLogs3 = [
        {
          blockNumber: 350,
          transactionHash: "0x444",
          index: 0,
          address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
          topics: [
            RECIPIENT_RECIEVED_EVENT_TOPIC,
            ethers.zeroPadValue(
              "0x4444444444444444444444444444444444444444",
              32,
            ),
          ],
          data: ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256"],
            ["4000000000000000000"],
          ),
        },
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

    it("handles empty event results for some date ranges", async () => {
      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);
      mockFileManager.writeRecipientRecievedEvents = jest.fn();

      mockProvider.getLogs
        .mockResolvedValueOnce([]) // Day 1: no events
        .mockResolvedValueOnce([
          {
            blockNumber: 250,
            transactionHash: "0x222",
            index: 0,
            address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
            topics: [
              RECIPIENT_RECIEVED_EVENT_TOPIC,
              ethers.zeroPadValue(
                "0x1234567890123456789012345678901234567890",
                32,
              ),
            ],
            data: ethers.AbiCoder.defaultAbiCoder().encode(
              ["uint256"],
              ["1000000000000000000"],
            ),
          },
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
      mockFileManager.writeRecipientRecievedEvents = jest.fn();
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

  describe("scan - event parsing and storage", () => {
    let scanner: RecipientRecievedScanner;
    let mockDistributorsData: DistributorsData;
    let mockBlockNumbersData: BlockNumberData;

    beforeEach(() => {
      jest.clearAllMocks();
      mockFileManager = createMockFileManager();
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

    it("parses RecipientRecieved events using ethers interface", async () => {
      const distributorAddress = "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB";

      // Mock event data - a RecipientRecieved event
      const mockRecipientAddress = "0x1234567890123456789012345678901234567890";
      const mockValue = "1000000000000000000"; // 1 ETH in wei

      // Create encoded topics for RecipientRecieved event
      // topic[0] = event signature hash
      // topic[1] = indexed recipient address (padded to 32 bytes)
      const mockTopics = [
        RECIPIENT_RECIEVED_EVENT_TOPIC,
        ethers.zeroPadValue(mockRecipientAddress, 32),
      ];

      // Create encoded data for the value (non-indexed parameter)
      const mockData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [mockValue],
      );

      const mockLogs = [
        {
          blockNumber: 150,
          transactionHash:
            "0xabc123def456789012345678901234567890123456789012345678901234567890",
          index: 0,
          address: distributorAddress,
          topics: mockTopics,
          data: mockData,
        },
      ] as unknown as ethers.Log[];

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);

      // First call returns undefined (no existing data), subsequent calls return accumulated data
      mockFileManager.readRecipientRecievedEvents
        .mockReturnValueOnce(undefined)
        .mockReturnValue({
          metadata: {
            chain_id: 42170,
            reward_distributor: distributorAddress,
            last_scanned_block: 150,
          },
          events: {
            "0xabc123def456789012345678901234567890123456789012345678901234567890:0":
              {
                blockNumber: 150,
                transactionHash:
                  "0xabc123def456789012345678901234567890123456789012345678901234567890",
                logIndex: 0,
                address: distributorAddress,
                topics: mockTopics,
                data: mockData,
                recipient: ethers.getAddress(mockRecipientAddress),
                value: mockValue,
              },
          },
        });

      mockProvider.getLogs.mockResolvedValue(mockLogs);

      await scanner.scan();

      // Verify that the event was parsed and saved
      expect(mockFileManager.writeRecipientRecievedEvents).toHaveBeenCalled();

      // Get the last call to writeRecipientRecievedEvents (final update with last_scanned_block)
      const calls = mockFileManager.writeRecipientRecievedEvents.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1];

      expect(lastCall![0]).toBe(distributorAddress);
      expect(lastCall![1]).toEqual(
        expect.objectContaining({
          metadata: {
            chain_id: 42170,
            reward_distributor: distributorAddress,
            last_scanned_block: 400, // Should be updated to the last block scanned
          },
          events: {
            "0xabc123def456789012345678901234567890123456789012345678901234567890:0":
              {
                blockNumber: 150,
                transactionHash:
                  "0xabc123def456789012345678901234567890123456789012345678901234567890",
                logIndex: 0,
                address: distributorAddress,
                topics: mockTopics,
                data: mockData,
                recipient: ethers.getAddress(mockRecipientAddress), // Should be checksummed
                value: mockValue,
              },
          },
        }),
      );
    });

    it("creates unique event keys using transactionHash:logIndex format", async () => {
      const distributorAddress = "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB";

      // Mock multiple events with different transaction hashes and log indices
      const mockLogs = [
        {
          blockNumber: 150,
          transactionHash:
            "0xabc123def456789012345678901234567890123456789012345678901234567890",
          index: 0,
          address: distributorAddress,
          topics: [
            RECIPIENT_RECIEVED_EVENT_TOPIC,
            ethers.zeroPadValue(
              "0x1111111111111111111111111111111111111111",
              32,
            ),
          ],
          data: ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256"],
            ["1000000000000000000"],
          ),
        },
        {
          blockNumber: 151,
          transactionHash:
            "0xabc123def456789012345678901234567890123456789012345678901234567890",
          index: 1,
          address: distributorAddress,
          topics: [
            RECIPIENT_RECIEVED_EVENT_TOPIC,
            ethers.zeroPadValue(
              "0x2222222222222222222222222222222222222222",
              32,
            ),
          ],
          data: ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256"],
            ["2000000000000000000"],
          ),
        },
        {
          blockNumber: 152,
          transactionHash:
            "0xdef456789012345678901234567890123456789012345678901234567890abcd",
          index: 0,
          address: distributorAddress,
          topics: [
            RECIPIENT_RECIEVED_EVENT_TOPIC,
            ethers.zeroPadValue(
              "0x3333333333333333333333333333333333333333",
              32,
            ),
          ],
          data: ethers.AbiCoder.defaultAbiCoder().encode(
            ["uint256"],
            ["3000000000000000000"],
          ),
        },
      ] as unknown as ethers.Log[];

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);
      mockProvider.getLogs.mockResolvedValue(mockLogs);

      await scanner.scan();

      // Check that writeRecipientRecievedEvents was called with correctly formatted keys
      const writeCalls =
        mockFileManager.writeRecipientRecievedEvents.mock.calls;
      expect(writeCalls.length).toBeGreaterThan(0);
      const firstCall = writeCalls[0];
      expect(firstCall).toBeDefined();
      const eventKeys = Object.keys(firstCall![1].events);

      expect(eventKeys).toContain(
        "0xabc123def456789012345678901234567890123456789012345678901234567890:0",
      );
      expect(eventKeys).toContain(
        "0xabc123def456789012345678901234567890123456789012345678901234567890:1",
      );
      expect(eventKeys).toContain(
        "0xdef456789012345678901234567890123456789012345678901234567890abcd:0",
      );
    });

    it("merges new events with existing event data", async () => {
      const distributorAddress = "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB";

      // Mock existing event data
      const existingEventData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: distributorAddress,
          last_scanned_block: 100,
        },
        events: {
          "0x111111111111111111111111111111111111111111111111111111111111111:0":
            {
              blockNumber: 50,
              transactionHash:
                "0x111111111111111111111111111111111111111111111111111111111111111",
              logIndex: 0,
              address: distributorAddress,
              topics: [
                RECIPIENT_RECIEVED_EVENT_TOPIC,
                ethers.zeroPadValue(
                  "0x0000000000000000000000000000000000000001",
                  32,
                ),
              ],
              data: "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000",
              recipient: "0x0000000000000000000000000000000000000001",
              value: "1000000000000000000",
            },
        },
      };

      // Mock new event
      const newEvent = {
        blockNumber: 150,
        transactionHash:
          "0x222222222222222222222222222222222222222222222222222222222222222",
        index: 0,
        address: distributorAddress,
        topics: [
          RECIPIENT_RECIEVED_EVENT_TOPIC,
          ethers.zeroPadValue("0x0000000000000000000000000000000000000002", 32),
        ],
        data: ethers.AbiCoder.defaultAbiCoder().encode(
          ["uint256"],
          ["2000000000000000000"],
        ),
      } as unknown as ethers.Log;

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents
        .mockReturnValueOnce(existingEventData)
        .mockReturnValue({
          ...existingEventData,
          events: {
            ...existingEventData.events,
            "0x222222222222222222222222222222222222222222222222222222222222222:0":
              {
                blockNumber: 150,
                transactionHash:
                  "0x222222222222222222222222222222222222222222222222222222222222222",
                logIndex: 0,
                address: distributorAddress,
                topics: [
                  RECIPIENT_RECIEVED_EVENT_TOPIC,
                  ethers.zeroPadValue(
                    "0x0000000000000000000000000000000000000002",
                    32,
                  ),
                ],
                data: ethers.AbiCoder.defaultAbiCoder().encode(
                  ["uint256"],
                  ["2000000000000000000"],
                ),
                recipient: "0x0000000000000000000000000000000000000002",
                value: "2000000000000000000",
              },
          },
        });
      mockProvider.getLogs.mockResolvedValue([newEvent]);

      await scanner.scan();

      // Verify both old and new events are preserved
      const calls = mockFileManager.writeRecipientRecievedEvents.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1];
      expect(lastCall).toBeDefined();
      const savedData = lastCall![1];

      expect(Object.keys(savedData.events)).toHaveLength(2);
      expect(savedData.events).toHaveProperty(
        "0x111111111111111111111111111111111111111111111111111111111111111:0",
      );
      expect(savedData.events).toHaveProperty(
        "0x222222222222222222222222222222222222222222222222222222222222222:0",
      );
    });

    it("stores recipient addresses in checksummed format", async () => {
      const distributorAddress = "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB";

      // Use lowercase address that should be checksummed
      const lowercaseRecipient = "0xabcdef0123456789012345678901234567890123";
      const checksummedRecipient = ethers.getAddress(lowercaseRecipient);

      const mockLog = {
        blockNumber: 150,
        transactionHash:
          "0xabc123def456789012345678901234567890123456789012345678901234567890",
        index: 0,
        address: distributorAddress,
        topics: [
          RECIPIENT_RECIEVED_EVENT_TOPIC,
          ethers.zeroPadValue(lowercaseRecipient, 32),
        ],
        data: ethers.AbiCoder.defaultAbiCoder().encode(
          ["uint256"],
          ["1000000000000000000"],
        ),
      } as unknown as ethers.Log;

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);
      mockProvider.getLogs.mockResolvedValue([mockLog]);

      await scanner.scan();

      // Verify the recipient address is stored in checksummed format
      const calls = mockFileManager.writeRecipientRecievedEvents.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const firstCall = calls[0];
      expect(firstCall).toBeDefined();
      const savedEvent =
        firstCall![1].events[
          "0xabc123def456789012345678901234567890123456789012345678901234567890:0"
        ];
      expect(savedEvent).toBeDefined();

      expect(savedEvent!.recipient).toBe(checksummedRecipient);
      expect(savedEvent!.recipient).not.toBe(lowercaseRecipient);
    });

    it("updates last_scanned_block to the highest block processed", async () => {
      const distributorAddress = "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB";

      // Mock events across multiple days with different block numbers
      const day1Events = [
        {
          blockNumber: 150,
          transactionHash: "0x111",
          index: 0,
          address: distributorAddress,
          topics: [
            RECIPIENT_RECIEVED_EVENT_TOPIC,
            ethers.zeroPadValue("0x1111", 32),
          ],
          data: ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], ["1000"]),
        },
      ] as unknown as ethers.Log[];

      const day2Events = [
        {
          blockNumber: 250,
          transactionHash: "0x222",
          index: 0,
          address: distributorAddress,
          topics: [
            RECIPIENT_RECIEVED_EVENT_TOPIC,
            ethers.zeroPadValue("0x2222", 32),
          ],
          data: ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], ["2000"]),
        },
      ] as unknown as ethers.Log[];

      const day3Events = [
        {
          blockNumber: 350,
          transactionHash: "0x333",
          index: 0,
          address: distributorAddress,
          topics: [
            RECIPIENT_RECIEVED_EVENT_TOPIC,
            ethers.zeroPadValue("0x3333", 32),
          ],
          data: ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], ["3000"]),
        },
      ] as unknown as ethers.Log[];

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);

      // Mock readRecipientRecievedEvents to return accumulated data for final update
      const accumulatedData = {
        metadata: {
          chain_id: 42170,
          reward_distributor: distributorAddress,
          last_scanned_block: 350,
        },
        events: {
          "0x111:0": {
            blockNumber: 150,
            transactionHash: "0x111",
            logIndex: 0,
            address: distributorAddress,
            topics: [
              RECIPIENT_RECIEVED_EVENT_TOPIC,
              ethers.zeroPadValue("0x1111", 32),
            ],
            data: ethers.AbiCoder.defaultAbiCoder().encode(
              ["uint256"],
              ["1000"],
            ),
            recipient: "0x0000000000000000000000000000000000001111",
            value: "1000",
          },
          "0x222:0": {
            blockNumber: 250,
            transactionHash: "0x222",
            logIndex: 0,
            address: distributorAddress,
            topics: [
              RECIPIENT_RECIEVED_EVENT_TOPIC,
              ethers.zeroPadValue("0x2222", 32),
            ],
            data: ethers.AbiCoder.defaultAbiCoder().encode(
              ["uint256"],
              ["2000"],
            ),
            recipient: "0x0000000000000000000000000000000000002222",
            value: "2000",
          },
          "0x333:0": {
            blockNumber: 350,
            transactionHash: "0x333",
            logIndex: 0,
            address: distributorAddress,
            topics: [
              RECIPIENT_RECIEVED_EVENT_TOPIC,
              ethers.zeroPadValue("0x3333", 32),
            ],
            data: ethers.AbiCoder.defaultAbiCoder().encode(
              ["uint256"],
              ["3000"],
            ),
            recipient: "0x0000000000000000000000000000000000003333",
            value: "3000",
          },
        },
      };

      mockFileManager.readRecipientRecievedEvents
        .mockReturnValueOnce(undefined) // First read for existing data
        .mockReturnValue(accumulatedData); // Subsequent reads return accumulated data

      // Return different events for each day
      mockProvider.getLogs
        .mockResolvedValueOnce(day1Events)
        .mockResolvedValueOnce(day2Events)
        .mockResolvedValueOnce(day3Events);

      await scanner.scan();

      // Verify the last_scanned_block is set to the highest block (400 - last day's endBlock)
      const calls = mockFileManager.writeRecipientRecievedEvents.mock.calls;
      const finalCall = calls[calls.length - 1];
      expect(finalCall).toBeDefined();
      expect(finalCall![1].metadata.last_scanned_block).toBe(400);
    });
  });

  describe("scan - reward distributor filtering", () => {
    let scanner: RecipientRecievedScanner;
    let mockDistributorsData: DistributorsData;
    let mockBlockNumbersData: BlockNumberData;

    beforeEach(() => {
      jest.clearAllMocks();
      mockFileManager = createMockFileManager();
      mockProvider = {
        getLogs: jest.fn().mockResolvedValue([]),
      } as unknown as jest.Mocked<ethers.Provider>;
      scanner = new RecipientRecievedScanner(mockProvider, mockFileManager);

      // Set up a mock date for "today" to make tests deterministic
      jest.useFakeTimers().setSystemTime(new Date("2022-07-15"));

      mockBlockNumbersData = {
        metadata: { chain_id: 42170 },
        blocks: {
          "2022-07-12": 200,
          "2022-07-13": 300,
          "2022-07-14": 400,
        },
      };
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("skips distributors where is_reward_distributor is false", async () => {
      mockDistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
          last_scanned_block: 1000,
        },
        distributors: {
          "0xNonRewardDistributor": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            method: "0xfcdde2b4",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: false,
            distributor_address: "0xNonRewardDistributor",
          },
          "0xRewardDistributor": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            method: "0xfcdde2b4",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: true,
            distributor_address: "0xRewardDistributor",
          },
        },
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      await scanner.scan();

      // Should only query logs for the reward distributor
      const logCalls = mockProvider.getLogs.mock.calls;

      // Verify getLogs was never called for non-reward distributor
      expect(
        logCalls.some((call) => call[0].address === "0xNonRewardDistributor"),
      ).toBe(false);

      // Verify getLogs was called for reward distributor
      expect(
        logCalls.some((call) => call[0].address === "0xRewardDistributor"),
      ).toBe(true);

      // Should have 3 calls total (3 days for 1 distributor)
      expect(mockProvider.getLogs).toHaveBeenCalledTimes(3);
    });

    it("only logs progress for reward distributors and logs skip message for non-reward distributors", async () => {
      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

      mockDistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
          last_scanned_block: 1000,
        },
        distributors: {
          "0xNonReward1": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x1111111111111111111111111111111111111111111111111111111111111111",
            method: "0xfcdde2b4",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: false,
            distributor_address: "0xNonReward1",
          },
          "0xRewardDistributor": {
            type: DistributorType.L2_BASE_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x2222222222222222222222222222222222222222222222222222222222222222",
            method: "0xfcdde2b4",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: true,
            distributor_address: "0xRewardDistributor",
          },
          "0xNonReward2": {
            type: DistributorType.L1_BASE_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x3333333333333333333333333333333333333333333333333333333333333333",
            method: "0xfcdde2b4",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: false,
            distributor_address: "0xNonReward2",
          },
        },
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      await scanner.scan();

      // Should not log progress for non-reward distributors
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining(
          "Scanning events for distributor 1/3: 0xNonReward1",
        ),
      );
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining(
          "Scanning events for distributor 3/3: 0xNonReward2",
        ),
      );

      // Should log skip message for non-reward distributors
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Skipping distributor 0xNonReward1: not a reward distributor",
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Skipping distributor 0xNonReward2: not a reward distributor",
      );

      // Should log progress for reward distributors with correct counter
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Scanning events for distributor 1/1: 0xRewardDistributor",
      );

      consoleLogSpy.mockRestore();
    });

    it("processes distributors where is_reward_distributor is true", async () => {
      mockDistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
          last_scanned_block: 1000,
        },
        distributors: {
          "0xRewardDistributor1": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x1111111111111111111111111111111111111111111111111111111111111111",
            method: "0xfcdde2b4",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: true,
            distributor_address: "0xRewardDistributor1",
          },
          "0xRewardDistributor2": {
            type: DistributorType.L2_BASE_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x2222222222222222222222222222222222222222222222222222222222222222",
            method: "0xfcdde2b4",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: true,
            distributor_address: "0xRewardDistributor2",
          },
        },
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      await scanner.scan();

      // Should query logs for both reward distributors
      const logCalls = mockProvider.getLogs.mock.calls;
      const addressesCalled = [
        ...new Set(logCalls.map((call) => call[0].address)),
      ];

      expect(addressesCalled).toContain("0xRewardDistributor1");
      expect(addressesCalled).toContain("0xRewardDistributor2");

      // Should have 6 calls total (3 days × 2 distributors)
      expect(mockProvider.getLogs).toHaveBeenCalledTimes(6);
    });

    it("skips all distributors when none are reward distributors", async () => {
      mockDistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
          last_scanned_block: 1000,
        },
        distributors: {
          "0xNonReward1": {
            type: DistributorType.L2_SURPLUS_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x1111111111111111111111111111111111111111111111111111111111111111",
            method: "0xfcdde2b4",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: false,
            distributor_address: "0xNonReward1",
          },
          "0xNonReward2": {
            type: DistributorType.L2_BASE_FEE,
            block: 152,
            date: "2022-07-12",
            tx_hash:
              "0x2222222222222222222222222222222222222222222222222222222222222222",
            method: "0xfcdde2b4",
            owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
            event_data: "0x...",
            is_reward_distributor: false,
            distributor_address: "0xNonReward2",
          },
        },
      };

      mockFileManager.readDistributors.mockReturnValue(mockDistributorsData);
      mockFileManager.readBlockNumbers.mockReturnValue(mockBlockNumbersData);
      mockFileManager.readRecipientRecievedEvents.mockReturnValue(undefined);

      await scanner.scan();

      // Should not query any logs
      expect(mockProvider.getLogs).not.toHaveBeenCalled();

      // Should not write any events
      expect(
        mockFileManager.writeRecipientRecievedEvents,
      ).not.toHaveBeenCalled();
    });
  });
});

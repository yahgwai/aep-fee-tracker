import { DistributorDetector } from "../../../src/distributor-detector";
import { FileManager } from "../../../src/file-manager";
import {
  DistributorsData,
  BlockNumberData,
  DistributorInfo,
  DistributorType,
} from "../../../src/types";
import { ethers } from "ethers";

// Mock dependencies
jest.mock("../../../src/file-manager");

describe("DistributorDetector.detectDistributors", () => {
  let detector: DistributorDetector;
  let mockFileManager: jest.Mocked<FileManager>;
  let mockProvider: jest.Mocked<ethers.Provider>;
  let scanBlockRangeSpy: jest.SpyInstance;

  // Test data
  const testBlockNumbers: BlockNumberData = {
    metadata: { chain_id: 42170 },
    blocks: {
      "2023-03-14": 100,
      "2023-03-15": 200,
      "2023-03-16": 300,
      "2023-03-17": 400,
    },
  };

  const existingDistributors: DistributorsData = {
    metadata: {
      chain_id: 42170,
      arbowner_address: "0x0000000000000000000000000000000000000070",
      last_scanned_block: 150,
    },
    distributors: {
      "0x1234567890123456789012345678901234567890": {
        type: DistributorType.L2_BASE_FEE,
        block: 120,
        date: "2023-03-14",
        tx_hash: "0x" + "a".repeat(64),
        method: "0x12345678",
        owner: "0xABCDEF0123456789012345678901234567890123",
        event_data: "0x",
        is_reward_distributor: true,
        distributor_address: "0x1234567890123456789012345678901234567890",
      },
    },
  };

  const newDistributorInfo: DistributorInfo = {
    type: DistributorType.L2_SURPLUS_FEE,
    block: 250,
    date: "2023-03-16",
    tx_hash: "0x" + "b".repeat(64),
    method: "0x87654321",
    owner: "0xFEDCBA9876543210987654321098765432109876",
    event_data: "0x",
    is_reward_distributor: false,
    distributor_address: "0xABCDEF0123456789ABCDEF0123456789ABCDEF01",
  };

  beforeEach(() => {
    // Mock FileManager
    mockFileManager = new FileManager("test-store") as jest.Mocked<FileManager>;
    mockFileManager.readDistributors = jest.fn();
    mockFileManager.writeDistributors = jest.fn();
    mockFileManager.readBlockNumbers = jest.fn();

    // Mock Provider
    mockProvider = {
      getNetwork: jest.fn().mockResolvedValue({ chainId: 42170n }),
    } as unknown as jest.Mocked<ethers.Provider>;

    // Create detector instance
    detector = new DistributorDetector(mockFileManager, mockProvider);

    // Spy on scanBlockRange static method
    scanBlockRangeSpy = jest.spyOn(DistributorDetector, "scanBlockRange");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("successful detection", () => {
    it("should handle first run when no existing data exists", async () => {
      // Arrange
      const endDate = new Date("2023-03-16");
      mockFileManager.readDistributors.mockReturnValue(undefined);
      mockFileManager.readBlockNumbers.mockReturnValue(testBlockNumbers);
      scanBlockRangeSpy.mockResolvedValue([newDistributorInfo]);

      // Act
      const result = await detector.detectDistributors(endDate);

      // Assert
      expect(mockFileManager.readDistributors).toHaveBeenCalledTimes(1);
      expect(mockFileManager.readBlockNumbers).toHaveBeenCalledTimes(1);
      expect(scanBlockRangeSpy).toHaveBeenCalledWith(mockProvider, 0, 300);

      const expectedData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
          last_scanned_block: 300,
        },
        distributors: {
          "0xABCDEF0123456789ABCDEF0123456789ABCDEF01": newDistributorInfo,
        },
      };

      expect(mockFileManager.writeDistributors).toHaveBeenCalledWith(
        expectedData,
      );
      expect(result).toEqual(expectedData);
    });

    it("should perform incremental scan from last_scanned_block", async () => {
      // Arrange
      const endDate = new Date("2023-03-17");
      mockFileManager.readDistributors.mockReturnValue(existingDistributors);
      mockFileManager.readBlockNumbers.mockReturnValue(testBlockNumbers);
      scanBlockRangeSpy.mockResolvedValue([newDistributorInfo]);

      // Act
      const result = await detector.detectDistributors(endDate);

      // Assert
      expect(scanBlockRangeSpy).toHaveBeenCalledWith(mockProvider, 151, 400);

      const expectedData: DistributorsData = {
        metadata: {
          chain_id: 42170,
          arbowner_address: "0x0000000000000000000000000000000000000070",
          last_scanned_block: 400,
        },
        distributors: {
          "0x1234567890123456789012345678901234567890":
            existingDistributors.distributors[
              "0x1234567890123456789012345678901234567890"
            ]!,
          "0xABCDEF0123456789ABCDEF0123456789ABCDEF01": newDistributorInfo,
        },
      };

      expect(mockFileManager.writeDistributors).toHaveBeenCalledWith(
        expectedData,
      );
      expect(result).toEqual(expectedData);
    });

    it("should return existing data without scanning when already up-to-date", async () => {
      // Arrange
      const endDate = new Date("2023-03-15");
      const upToDateDistributors = {
        ...existingDistributors,
        metadata: {
          ...existingDistributors.metadata,
          last_scanned_block: 200,
        },
      };
      mockFileManager.readDistributors.mockReturnValue(upToDateDistributors);
      mockFileManager.readBlockNumbers.mockReturnValue(testBlockNumbers);

      // Act
      const result = await detector.detectDistributors(endDate);

      // Assert
      expect(scanBlockRangeSpy).not.toHaveBeenCalled();
      expect(mockFileManager.writeDistributors).not.toHaveBeenCalled();
      expect(result).toEqual(upToDateDistributors);
    });

    it("should handle empty scan results", async () => {
      // Arrange
      const endDate = new Date("2023-03-16");
      mockFileManager.readDistributors.mockReturnValue(existingDistributors);
      mockFileManager.readBlockNumbers.mockReturnValue(testBlockNumbers);
      scanBlockRangeSpy.mockResolvedValue([]);

      // Act
      const result = await detector.detectDistributors(endDate);

      // Assert
      expect(scanBlockRangeSpy).toHaveBeenCalledWith(mockProvider, 151, 300);

      const expectedData: DistributorsData = {
        metadata: {
          ...existingDistributors.metadata,
          last_scanned_block: 300,
        },
        distributors: existingDistributors.distributors,
      };

      expect(mockFileManager.writeDistributors).toHaveBeenCalledWith(
        expectedData,
      );
      expect(result).toEqual(expectedData);
    });

    it("should skip already known distributors", async () => {
      // Arrange
      const endDate = new Date("2023-03-16");
      const duplicateDistributor: DistributorInfo = {
        ...existingDistributors.distributors[
          "0x1234567890123456789012345678901234567890"
        ]!,
        block: 180,
        date: "2023-03-15",
      };

      mockFileManager.readDistributors.mockReturnValue(existingDistributors);
      mockFileManager.readBlockNumbers.mockReturnValue(testBlockNumbers);
      scanBlockRangeSpy.mockResolvedValue([
        duplicateDistributor,
        newDistributorInfo,
      ]);

      // Act
      const result = await detector.detectDistributors(endDate);

      // Assert
      const expectedData: DistributorsData = {
        metadata: {
          ...existingDistributors.metadata,
          last_scanned_block: 300,
        },
        distributors: {
          "0x1234567890123456789012345678901234567890":
            existingDistributors.distributors[
              "0x1234567890123456789012345678901234567890"
            ]!,
          "0xABCDEF0123456789ABCDEF0123456789ABCDEF01": newDistributorInfo,
        },
      };

      expect(mockFileManager.writeDistributors).toHaveBeenCalledWith(
        expectedData,
      );
      expect(result).toEqual(expectedData);
    });
  });

  describe("error handling", () => {
    it("should throw error when end date not found in block numbers", async () => {
      // Arrange
      const endDate = new Date("2023-03-20");
      mockFileManager.readDistributors.mockReturnValue(existingDistributors);
      mockFileManager.readBlockNumbers.mockReturnValue(testBlockNumbers);

      // Act & Assert
      await expect(detector.detectDistributors(endDate)).rejects.toThrow(
        "Block number not found for date 2023-03-20",
      );

      expect(scanBlockRangeSpy).not.toHaveBeenCalled();
      expect(mockFileManager.writeDistributors).not.toHaveBeenCalled();
    });

    it("should throw error when block numbers data is missing", async () => {
      // Arrange
      const endDate = new Date("2023-03-16");
      mockFileManager.readDistributors.mockReturnValue(existingDistributors);
      mockFileManager.readBlockNumbers.mockReturnValue(undefined);

      // Act & Assert
      await expect(detector.detectDistributors(endDate)).rejects.toThrow(
        "Block numbers data not found",
      );

      expect(scanBlockRangeSpy).not.toHaveBeenCalled();
      expect(mockFileManager.writeDistributors).not.toHaveBeenCalled();
    });

    it("should propagate errors from scanBlockRange", async () => {
      // Arrange
      const endDate = new Date("2023-03-16");
      const scanError = new Error("RPC connection failed");
      mockFileManager.readDistributors.mockReturnValue(existingDistributors);
      mockFileManager.readBlockNumbers.mockReturnValue(testBlockNumbers);
      scanBlockRangeSpy.mockRejectedValue(scanError);

      // Act & Assert
      await expect(detector.detectDistributors(endDate)).rejects.toThrow(
        "RPC connection failed",
      );

      expect(mockFileManager.writeDistributors).not.toHaveBeenCalled();
    });

    it("should propagate errors from FileManager writes", async () => {
      // Arrange
      const endDate = new Date("2023-03-16");
      const writeError = new Error("Disk full");
      mockFileManager.readDistributors.mockReturnValue(existingDistributors);
      mockFileManager.readBlockNumbers.mockReturnValue(testBlockNumbers);
      mockFileManager.writeDistributors.mockImplementation(() => {
        throw writeError;
      });
      scanBlockRangeSpy.mockResolvedValue([newDistributorInfo]);

      // Act & Assert
      await expect(detector.detectDistributors(endDate)).rejects.toThrow(
        "Disk full",
      );
    });
  });

  describe("chain ID handling", () => {
    it("should get chain ID from provider for new data", async () => {
      // Arrange
      const endDate = new Date("2023-03-16");
      mockFileManager.readDistributors.mockReturnValue(undefined);
      mockFileManager.readBlockNumbers.mockReturnValue(testBlockNumbers);
      scanBlockRangeSpy.mockResolvedValue([newDistributorInfo]);

      // Act
      await detector.detectDistributors(endDate);

      // Assert
      expect(mockProvider.getNetwork).toHaveBeenCalledTimes(1);
      const writtenData = mockFileManager.writeDistributors.mock
        .calls[0]![0] as DistributorsData;
      expect(writtenData.metadata.chain_id).toBe(42170);
    });

    it("should preserve existing chain ID when updating", async () => {
      // Arrange
      const endDate = new Date("2023-03-16");
      const existingWithDifferentChain = {
        ...existingDistributors,
        metadata: {
          ...existingDistributors.metadata,
          chain_id: 99999,
        },
      };
      mockFileManager.readDistributors.mockReturnValue(
        existingWithDifferentChain,
      );
      mockFileManager.readBlockNumbers.mockReturnValue(testBlockNumbers);
      scanBlockRangeSpy.mockResolvedValue([newDistributorInfo]);

      // Act
      await detector.detectDistributors(endDate);

      // Assert
      expect(mockProvider.getNetwork).toHaveBeenCalledTimes(1);
      const writtenData = mockFileManager.writeDistributors.mock
        .calls[0]![0] as DistributorsData;
      expect(writtenData.metadata.chain_id).toBe(42170);
    });
  });

  describe("date formatting", () => {
    it("should format date correctly for block lookup", async () => {
      // Arrange
      const endDate = new Date("2023-03-16T12:34:56.789Z");
      mockFileManager.readDistributors.mockReturnValue(existingDistributors);
      mockFileManager.readBlockNumbers.mockReturnValue(testBlockNumbers);
      scanBlockRangeSpy.mockResolvedValue([]);

      // Act
      await detector.detectDistributors(endDate);

      // Assert
      expect(mockFileManager.readBlockNumbers).toHaveBeenCalled();
      expect(scanBlockRangeSpy).toHaveBeenCalledWith(mockProvider, 151, 300);
    });
  });
});

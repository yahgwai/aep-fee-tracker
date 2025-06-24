import { ethers } from "ethers";
import { FileManager } from "../../src/file-manager";
import { RecipientRecievedScanner } from "../../src/recipient-recieved-scanner";
import {
  DistributorType,
  DistributorsData,
  BlockNumberData,
} from "../../src/types";

jest.mock("../../src/file-manager");

// Mock the withRetry function to avoid timeouts
jest.mock("../../src/utils/retry", () => ({
  withRetry: jest.fn((fn) => fn()),
}));

describe("RecipientRecievedScanner - Multi-distributor error isolation", () => {
  let mockFileManager: jest.Mocked<FileManager>;
  let mockProvider: jest.Mocked<ethers.Provider>;
  let scanner: RecipientRecievedScanner;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let mockDate: Date;

  const validDistributor1 = "0x1111111111111111111111111111111111111111";
  const validDistributor2 = "0x2222222222222222222222222222222222222222";
  const validDistributor3 = "0x3333333333333333333333333333333333333333";

  const mockDistributorsData: DistributorsData = {
    metadata: {
      chain_id: 1,
      arbowner_address: "0x0000000000000000000000000000000000000000",
    },
    distributors: {
      [validDistributor1]: {
        type: DistributorType.L2_BASE_FEE,
        date: "2024-01-01",
        block: 1000,
        tx_hash: "0x1111",
        method: "deployDistributor",
        owner: "0x0000000000000000000000000000000000000000",
        event_data: "0x",
        is_reward_distributor: true,
        distributor_address: validDistributor1,
      },
      [validDistributor2]: {
        type: DistributorType.L2_BASE_FEE,
        date: "2024-01-01",
        block: 1000,
        tx_hash: "0x2222",
        method: "deployDistributor",
        owner: "0x0000000000000000000000000000000000000000",
        event_data: "0x",
        is_reward_distributor: true,
        distributor_address: validDistributor2,
      },
      [validDistributor3]: {
        type: DistributorType.L2_BASE_FEE,
        date: "2024-01-01",
        block: 1000,
        tx_hash: "0x3333",
        method: "deployDistributor",
        owner: "0x0000000000000000000000000000000000000000",
        event_data: "0x",
        is_reward_distributor: true,
        distributor_address: validDistributor3,
      },
    },
  };

  const mockBlockNumbersData: BlockNumberData = {
    metadata: {
      chain_id: 1,
    },
    blocks: {
      "2023-12-31": 900,
      "2024-01-01": 1000,
      "2024-01-02": 2000,
      "2024-01-03": 3000,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the current date to be 2024-01-04
    mockDate = new Date("2024-01-04");
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);

    mockFileManager = {
      readDistributors: jest.fn().mockReturnValue(mockDistributorsData),
      readBlockNumbers: jest.fn().mockReturnValue(mockBlockNumbersData),
      readRecipientRecievedEvents: jest.fn().mockReturnValue(undefined),
      writeRecipientRecievedEvents: jest.fn(),
    } as unknown as jest.Mocked<FileManager>;

    mockProvider = {
      getLogs: jest.fn().mockResolvedValue([]),
      getNetwork: jest.fn().mockResolvedValue({ chainId: 1n }),
    } as unknown as jest.Mocked<ethers.Provider>;

    scanner = new RecipientRecievedScanner(mockProvider, mockFileManager);

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    jest.useRealTimers();
  });

  describe("Error isolation", () => {
    it("continues processing remaining distributors when one fails", async () => {
      // Arrange
      mockProvider.getLogs
        .mockResolvedValueOnce([]) // distributor1 day1
        .mockResolvedValueOnce([]) // distributor1 day2
        .mockResolvedValueOnce([]) // distributor1 day3
        .mockRejectedValueOnce(new Error("RPC error for distributor2")) // distributor2 day1 fails
        .mockResolvedValueOnce([]) // distributor3 day1
        .mockResolvedValueOnce([]) // distributor3 day2
        .mockResolvedValue([]); // distributor3 day3

      // Act
      await scanner.scan();

      // Assert
      expect(
        mockFileManager.writeRecipientRecievedEvents,
      ).toHaveBeenCalledTimes(2);
      expect(mockFileManager.writeRecipientRecievedEvents).toHaveBeenCalledWith(
        validDistributor1,
        expect.any(Object),
      );
      expect(mockFileManager.writeRecipientRecievedEvents).toHaveBeenCalledWith(
        validDistributor3,
        expect.any(Object),
      );
      expect(
        mockFileManager.writeRecipientRecievedEvents,
      ).not.toHaveBeenCalledWith(validDistributor2, expect.any(Object));
    });

    it("continues processing when multiple distributors fail", async () => {
      // Arrange
      mockProvider.getLogs
        .mockRejectedValueOnce(new Error("RPC error for distributor1")) // distributor1 fails
        .mockRejectedValueOnce(new Error("RPC error for distributor2")) // distributor2 fails
        .mockResolvedValue([]); // distributor3 succeeds

      // Act
      await scanner.scan();

      // Assert
      expect(
        mockFileManager.writeRecipientRecievedEvents,
      ).toHaveBeenCalledTimes(1);
      expect(mockFileManager.writeRecipientRecievedEvents).toHaveBeenCalledWith(
        validDistributor3,
        expect.any(Object),
      );
    });

    it("handles case where all distributors fail", async () => {
      // Arrange
      mockProvider.getLogs.mockRejectedValue(
        new Error("RPC error for all distributors"),
      );

      // Act
      await scanner.scan();

      // Assert
      expect(
        mockFileManager.writeRecipientRecievedEvents,
      ).not.toHaveBeenCalled();
    });
  });

  describe("Error logging", () => {
    it("logs individual distributor errors with context", async () => {
      // Arrange
      const error = new Error("RPC timeout");
      mockProvider.getLogs
        .mockResolvedValueOnce([]) // distributor1 day1
        .mockResolvedValueOnce([]) // distributor1 day2
        .mockResolvedValueOnce([]) // distributor1 day3
        .mockRejectedValueOnce(error) // distributor2 day1 fails
        .mockResolvedValueOnce([]) // distributor3 day1
        .mockResolvedValueOnce([]) // distributor3 day2
        .mockResolvedValue([]); // distributor3 day3

      // Act
      await scanner.scan();

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Failed to scan distributor ${validDistributor2}:`,
        error,
      );
    });

    it("logs summary after processing all distributors", async () => {
      // Arrange
      mockProvider.getLogs
        .mockResolvedValueOnce([]) // distributor1 succeeds
        .mockRejectedValueOnce(new Error("RPC error")) // distributor2 fails
        .mockResolvedValue([]); // distributor3 succeeds

      // Act
      await scanner.scan();

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Scanned 2 distributors successfully",
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Failed to scan 1 distributors",
      );
    });

    it("logs only success message when all distributors succeed", async () => {
      // Arrange
      mockProvider.getLogs.mockResolvedValue([]);

      // Act
      await scanner.scan();

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Scanned 3 distributors successfully",
      );
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Failed to scan"),
      );
    });

    it("logs only failure message when all distributors fail", async () => {
      // Arrange
      mockProvider.getLogs.mockRejectedValue(new Error("RPC error"));

      // Act
      await scanner.scan();

      // Assert
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("successfully"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Failed to scan 3 distributors",
      );
    });
  });

  describe("Critical error handling", () => {
    it("throws error when file read fails", async () => {
      // Arrange
      mockFileManager.readDistributors.mockImplementation(() => {
        throw new Error("File read error");
      });

      // Act & Assert
      await expect(scanner.scan()).rejects.toThrow("File read error");
    });

    it("throws error when RPC connection fails for all distributors", async () => {
      // Arrange
      const connectionError = new Error("Provider connection failed");
      mockProvider.getLogs.mockRejectedValue(connectionError);

      // Override getNetwork to fail (indicating connection issue)
      mockProvider.getNetwork.mockRejectedValue(connectionError);

      // Act & Assert
      await expect(scanner.scan()).rejects.toThrow(
        "Provider connection failed",
      );
    });

    it("does not throw when only some distributors have RPC errors", async () => {
      // Arrange
      mockProvider.getLogs
        .mockResolvedValueOnce([]) // distributor1 succeeds
        .mockRejectedValueOnce(new Error("RPC error")); // distributor2 fails

      // Act & Assert
      await expect(scanner.scan()).resolves.not.toThrow();
    });
  });

  describe("Processing behavior", () => {
    it("processes distributors when no specific address is provided", async () => {
      // Arrange
      mockProvider.getLogs.mockResolvedValue([]);

      // Act
      await scanner.scan(); // No distributorAddress parameter

      // Assert
      expect(mockProvider.getLogs).toHaveBeenCalledTimes(9); // 3 distributors * 3 days each
    });

    it("does not apply error isolation when specific distributor address is provided", async () => {
      // Arrange
      mockProvider.getLogs.mockRejectedValue(new Error("RPC error"));

      // Act & Assert
      await expect(scanner.scan(validDistributor1)).rejects.toThrow(
        "RPC error",
      );
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Scanned"),
      );
    });
  });
});

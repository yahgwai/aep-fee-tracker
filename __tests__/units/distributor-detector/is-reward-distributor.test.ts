import { ethers } from "ethers";
import { DistributorDetector } from "../../../src/distributor-detector";
import { REWARD_DISTRIBUTOR_BYTECODE } from "../../../src/constants/reward-distributor-bytecode";
import { withRetry } from "../../../src/utils/retry";

// Mock the retry utility
jest.mock("../../../src/utils/retry", () => ({
  withRetry: jest.fn((operation) => operation()),
}));

describe("DistributorDetector.isRewardDistributor", () => {
  let mockProvider: jest.Mocked<ethers.Provider>;

  beforeEach(() => {
    mockProvider = {
      getCode: jest.fn(),
    } as unknown as jest.Mocked<ethers.Provider>;

    // Reset the retry mock
    (withRetry as jest.Mock).mockImplementation((operation) => operation());
  });

  describe("Valid reward distributor", () => {
    it("returns true when bytecode matches REWARD_DISTRIBUTOR_BYTECODE", async () => {
      const testAddress = "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce";
      mockProvider.getCode.mockResolvedValue(REWARD_DISTRIBUTOR_BYTECODE);

      const result = await DistributorDetector.isRewardDistributor(
        mockProvider,
        testAddress,
      );

      expect(result).toBe(true);
      expect(mockProvider.getCode).toHaveBeenCalledWith(testAddress);
    });
  });

  describe("Non-reward distributor contract", () => {
    it("returns false when bytecode does not match", async () => {
      const testAddress = "0x1234567890123456789012345678901234567890";
      const differentBytecode =
        "0x608060405234801561001057600080fd5b50610150806100206000396000f3fe";
      mockProvider.getCode.mockResolvedValue(differentBytecode);

      const result = await DistributorDetector.isRewardDistributor(
        mockProvider,
        testAddress,
      );

      expect(result).toBe(false);
      expect(mockProvider.getCode).toHaveBeenCalledWith(testAddress);
    });
  });

  describe("Address with no deployed code", () => {
    it("returns false for EOA (externally owned account)", async () => {
      const eoaAddress = "0xabc1234567890123456789012345678901234567";
      mockProvider.getCode.mockResolvedValue("0x");

      const result = await DistributorDetector.isRewardDistributor(
        mockProvider,
        eoaAddress,
      );

      expect(result).toBe(false);
      expect(mockProvider.getCode).toHaveBeenCalledWith(eoaAddress);
    });
  });

  describe("Error handling", () => {
    it("returns false when provider.getCode throws an error", async () => {
      const testAddress = "0x1234567890123456789012345678901234567890";
      mockProvider.getCode.mockRejectedValue(new Error("Network error"));

      const result = await DistributorDetector.isRewardDistributor(
        mockProvider,
        testAddress,
      );

      expect(result).toBe(false);
      expect(mockProvider.getCode).toHaveBeenCalledWith(testAddress);
    });
  });

  describe("Retry logic", () => {
    it("uses withRetry wrapper for provider.getCode calls", async () => {
      const testAddress = "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce";
      mockProvider.getCode.mockResolvedValue(REWARD_DISTRIBUTOR_BYTECODE);

      await DistributorDetector.isRewardDistributor(mockProvider, testAddress);

      expect(withRetry).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          maxRetries: 3,
          operationName: `isRewardDistributor.getCode(${testAddress})`,
        }),
      );
    });

    it("retries on transient errors and eventually succeeds", async () => {
      const testAddress = "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce";

      // Mock withRetry to simulate retry behavior
      (withRetry as jest.Mock).mockImplementation(async (operation) => {
        // Simulate multiple attempts
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            return await operation();
          } catch (error) {
            if (attempt === 2) {
              // Succeed on third attempt
              mockProvider.getCode.mockResolvedValueOnce(
                REWARD_DISTRIBUTOR_BYTECODE,
              );
            }
            if (attempt < 2) {
              continue;
            }
            throw error;
          }
        }
      });

      mockProvider.getCode
        .mockRejectedValueOnce(new Error("Network timeout"))
        .mockRejectedValueOnce(new Error("Connection reset"))
        .mockResolvedValueOnce(REWARD_DISTRIBUTOR_BYTECODE);

      const result = await DistributorDetector.isRewardDistributor(
        mockProvider,
        testAddress,
      );

      expect(result).toBe(true);
      expect(mockProvider.getCode).toHaveBeenCalledTimes(3);
      expect(mockProvider.getCode).toHaveBeenCalledWith(testAddress);
    });

    it("returns false after exhausting all retry attempts", async () => {
      const testAddress = "0x1234567890123456789012345678901234567890";

      // Mock withRetry to simulate exhausting retries
      (withRetry as jest.Mock).mockRejectedValue(
        new Error("Network error after 3 retries"),
      );

      mockProvider.getCode.mockRejectedValue(new Error("Persistent error"));

      const result = await DistributorDetector.isRewardDistributor(
        mockProvider,
        testAddress,
      );

      expect(result).toBe(false);
      expect(withRetry).toHaveBeenCalled();
    });

    it("passes correct retry configuration", async () => {
      const testAddress = "0xabc1234567890123456789012345678901234567";
      mockProvider.getCode.mockResolvedValue("0x");

      await DistributorDetector.isRewardDistributor(mockProvider, testAddress);

      expect(withRetry).toHaveBeenCalledWith(expect.any(Function), {
        maxRetries: 3,
        operationName: `isRewardDistributor.getCode(${testAddress})`,
      });

      // Verify the wrapped function is correct
      const wrappedFunction = (withRetry as jest.Mock).mock.calls[0][0];
      await wrappedFunction();
      expect(mockProvider.getCode).toHaveBeenCalledWith(testAddress);
    });
  });
});

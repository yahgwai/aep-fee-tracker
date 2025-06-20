import { ethers } from "ethers";
import { DistributorDetector } from "../../../src/distributor-detector";
import { REWARD_DISTRIBUTOR_BYTECODE } from "../../../src/constants/reward-distributor-bytecode";

describe("DistributorDetector.isRewardDistributor", () => {
  let mockProvider: jest.Mocked<ethers.Provider>;

  beforeEach(() => {
    mockProvider = {
      getCode: jest.fn(),
    } as unknown as jest.Mocked<ethers.Provider>;
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
});

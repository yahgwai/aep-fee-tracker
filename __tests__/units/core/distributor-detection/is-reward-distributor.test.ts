import { ethers } from "ethers";
import { DistributorDetector } from "../../../../src/core/distributor-detection/distributor-detector";
import { REWARD_DISTRIBUTOR_BYTECODE } from "../../../../src/constants/reward-distributor-bytecode";
import { withRetry } from "../../../../src/utils/retry";

// Mock the retry utility
jest.mock("../../../../src/utils/retry", () => ({
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Valid reward distributor", () => {
    it("returns true when bytecode hash matches REWARD_DISTRIBUTOR_BYTECODE_HASH", async () => {
      const testAddress = "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce";
      mockProvider.getCode.mockResolvedValue(REWARD_DISTRIBUTOR_BYTECODE);

      // Create a spy on ethers.keccak256 to verify hash comparison is used
      const keccak256Spy = jest.spyOn(ethers, "keccak256");

      const result = await DistributorDetector.isRewardDistributor(
        mockProvider,
        testAddress,
      );

      expect(result).toBe(true);
      expect(mockProvider.getCode).toHaveBeenCalledWith(testAddress);
      // This expectation will fail in RED phase as the current implementation doesn't use keccak256
      expect(keccak256Spy).toHaveBeenCalledWith(REWARD_DISTRIBUTOR_BYTECODE);
    });

    it("returns true when bytecode hash matches the second valid hash", async () => {
      const testAddress = "0x1234567890123456789012345678901234567890";
      // Mock bytecode that would hash to 0xa7904d3bd7401c3158aea39169580e48698add2034b89ea52d657e96c22e1741
      const secondValidBytecode =
        "0x608060405234801561001057600080fd5b50600436106100415760003560e01c806391aee56e14610046578063a6980ce21461005b578063f2fde38b14610081575b600080fd5b6100596100543660046105e3565b610094565b005b610063604081565b6040516001600160401b0390911681526020015b60405180910390f35b61005961008f3660046106b8565b610325565b600054600160a01b900460ff16156100f35760405162461bcd60e51b815260206004820152601760248201527f496e697469616c697a61626c653a20636f6e747261637400000000000000000060448201526064015b60405180910390fd5b60005460ff600160a81b909104161061011c5760005460ff600160a81b90910416106000190161011c565b60005460ff600160a81b9091048116101561017b576000805460ff60a81b1916600160a81b60ff841602179055604051600181527f7f26b83ff96e1f2b6a682f133852f6798a09c465da95921460cefb38474024989060200160405180910390a15b8151600003610196576040516332e51a1160e21b815260040160405180910390fd5b80518251146101b8576040516374ef6df760e01b815260040160405180910390fd5b60006101cb838051602090810291012090565b90506000816001600160401b038111156101e7576101e76106d5565b604051908082528060200260200182016040528015610210578160200160208202803683370190505b50905060005b835181101561031f57600084828151811061023357610233610701565b60200260200101516001600160a01b031685838151811061025657610256610701565b60200260200101516040516000604051808303816000865af19150503d8060008114610299576040519150601f19603f3d011682016040523d82523d6000602084013e61029e565b606091505b505090508061031457808383815181106102ba576102ba610701565b602002602001018181525050858281518110156102d9576102d9610701565b60200260200101516001600160a01b03167f8b2a2b28e169eb0e4f62578e9d12f747d7bd0fe1ebc935af28387c18034d7cc08660405161032d91815260200190565b60405180910390a250610216565b6000805460ff60a81b1916600160a91b17905560405160008152600080516020610718833981519152906020015b60405180910390a150565b610381565b61032d6103af565b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b600080546001600160a01b031633146104055760405162461bcd60e51b815260206004820181905260248201527f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e657260448201526064016100ea565b50600080546001600160a01b0319169055565b5080356001600160a01b038116811461043057600080fd5b600082601f83011261044157600080fd5b81356001600160401b038082111561045b5761045b6106d5565b604051601f8301601f19908116603f01168101908282118183101715610483576104836106d5565b816040528381528660208588010111156104c757600080fd5b8360208701602083013760009181016020019190915250509250929050565b600082601f8301126104f857600080fd5b81356020610518610513836040516001600160401b03821682016106eb565b610530565b82815260059290921b8401810191818101908684111561053757600080fd5b8286015b84811015610559576105338135610418565b835291830191830161053b565b509695505050505050565b60008060408385031215610577";

      // Create a spy on ethers.keccak256
      const keccak256Spy = jest.spyOn(ethers, "keccak256");

      mockProvider.getCode.mockResolvedValue(secondValidBytecode);

      const result = await DistributorDetector.isRewardDistributor(
        mockProvider,
        testAddress,
      );

      // This test should fail in RED phase - expecting true but will get false
      expect(result).toBe(true);
      expect(mockProvider.getCode).toHaveBeenCalledWith(testAddress);
      expect(keccak256Spy).toHaveBeenCalledWith(secondValidBytecode);
    });
  });

  describe("Non-reward distributor contract", () => {
    it("returns false when bytecode hash does not match", async () => {
      const testAddress = "0x1234567890123456789012345678901234567890";
      const differentBytecode =
        "0x608060405234801561001057600080fd5b50610150806100206000396000f3fe";
      mockProvider.getCode.mockResolvedValue(differentBytecode);

      // Create a spy on ethers.keccak256 to verify hash comparison is used
      const keccak256Spy = jest.spyOn(ethers, "keccak256");

      const result = await DistributorDetector.isRewardDistributor(
        mockProvider,
        testAddress,
      );

      expect(result).toBe(false);
      expect(mockProvider.getCode).toHaveBeenCalledWith(testAddress);
      // This expectation will fail in RED phase as the current implementation doesn't use keccak256
      expect(keccak256Spy).toHaveBeenCalledWith(differentBytecode);
    });
  });

  describe("Address with no deployed code", () => {
    it("returns false for EOA (externally owned account)", async () => {
      const eoaAddress = "0xabc1234567890123456789012345678901234567";
      const emptyBytecode = "0x";
      mockProvider.getCode.mockResolvedValue(emptyBytecode);

      // Create a spy on ethers.keccak256 to verify hash comparison is used
      const keccak256Spy = jest.spyOn(ethers, "keccak256");

      const result = await DistributorDetector.isRewardDistributor(
        mockProvider,
        eoaAddress,
      );

      expect(result).toBe(false);
      expect(mockProvider.getCode).toHaveBeenCalledWith(eoaAddress);
      // This expectation will fail in RED phase as the current implementation doesn't use keccak256
      expect(keccak256Spy).toHaveBeenCalledWith(emptyBytecode);
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

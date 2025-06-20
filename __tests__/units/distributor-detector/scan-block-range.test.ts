import { DistributorDetector } from "../../../src/distributor-detector";
import { DistributorType } from "../../../src/types";
import {
  OWNER_ACTS_EVENT_SIGNATURE,
  ARBOWNER_PRECOMPILE_ADDRESS,
  ALL_DISTRIBUTOR_METHOD_SIGNATURES,
} from "../../../src/constants/distributor-detector";
import { ethers } from "ethers";
import testData from "../../test-data/distributor-detector/distributor-creation-events-raw.json";
import { withRetry } from "../../../src/utils/retry";

// Mock the retry utility
jest.mock("../../../src/utils/retry", () => ({
  withRetry: jest.fn((operation) => operation()),
}));

describe("DistributorDetector.scanBlockRange", () => {
  let mockProvider: jest.Mocked<ethers.Provider>;

  beforeEach(() => {
    mockProvider = {
      getLogs: jest.fn(),
      getBlock: jest.fn(),
      getCode: jest.fn(),
    } as unknown as jest.Mocked<ethers.Provider>;

    // Reset the retry mock
    (withRetry as jest.Mock).mockImplementation((operation) => operation());
  });

  describe("successful block range scanning", () => {
    it("should return array of DistributorInfo for events in block range", async () => {
      // Arrange: Use test data for 3 events from block 152-684
      const events = testData.events.slice(0, 3);
      const ethersLogs = events.map(
        (event) =>
          ({
            blockNumber: event.blockNumber,
            blockHash: "0x" + "0".repeat(64),
            transactionIndex: event.transactionIndex,
            removed: false,
            address: event.address,
            data: event.data,
            topics: event.topics as string[],
            transactionHash: event.transactionHash,
            index: event.logIndex,
          }) as unknown as ethers.Log,
      );

      mockProvider.getLogs.mockResolvedValue(ethersLogs);

      // Mock blocks for timestamps
      mockProvider.getBlock.mockImplementation(async (blockNumber) => {
        const event = events.find((e) => e.blockNumber === blockNumber);
        return {
          timestamp: event?.blockTimestamp || 0,
        } as ethers.Block;
      });

      // Mock bytecode checks - none are reward distributors in test data
      mockProvider.getCode.mockResolvedValue("0x1234");

      // Act
      const result = await DistributorDetector.scanBlockRange(
        mockProvider,
        150,
        700,
      );

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        type: DistributorType.L2_SURPLUS_FEE,
        block: 152,
        distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      });
      expect(result[1]).toMatchObject({
        type: DistributorType.L1_SURPLUS_FEE,
        block: 153,
        distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      });
      expect(result[2]).toMatchObject({
        type: DistributorType.L2_BASE_FEE,
        block: 684,
        distributor_address: "0xdff90519a9DE6ad469D4f9839a9220C5D340B792",
      });
    });

    it("should use correct filter with OR logic for method signatures", async () => {
      // Arrange
      mockProvider.getLogs.mockResolvedValue([]);

      // Act
      await DistributorDetector.scanBlockRange(mockProvider, 100, 200);

      // Assert
      expect(mockProvider.getLogs).toHaveBeenCalledWith({
        address: ARBOWNER_PRECOMPILE_ADDRESS,
        topics: [OWNER_ACTS_EVENT_SIGNATURE, ALL_DISTRIBUTOR_METHOD_SIGNATURES],
        fromBlock: 100,
        toBlock: 200,
      });
    });

    it("should return empty array when no events found", async () => {
      // Arrange
      mockProvider.getLogs.mockResolvedValue([]);

      // Act
      const result = await DistributorDetector.scanBlockRange(
        mockProvider,
        1000,
        2000,
      );

      // Assert
      expect(result).toEqual([]);
      expect(mockProvider.getLogs).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    it("should use retry logic for RPC calls", async () => {
      // Arrange
      const rpcError = new Error("RPC Error");
      mockProvider.getLogs.mockRejectedValue(rpcError);

      // Act & Assert
      await expect(
        DistributorDetector.scanBlockRange(mockProvider, 100, 200),
      ).rejects.toThrow("RPC Error");

      expect(withRetry).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          maxRetries: 3,
          operationName: "scanBlockRange.getLogs",
        }),
      );
    });

    it("should skip events that fail parseDistributorCreation", async () => {
      // Arrange
      const validEvent = testData.events[0]!;
      const invalidEvent = {
        ...validEvent,
        data: "0x", // Invalid data that will cause parsing to fail
      };

      const ethersLogs = [
        // Invalid event
        {
          blockNumber: invalidEvent.blockNumber,
          blockHash: "0x" + "0".repeat(64),
          transactionIndex: invalidEvent.transactionIndex,
          removed: false,
          address: invalidEvent.address,
          data: invalidEvent.data,
          topics: invalidEvent.topics as string[],
          transactionHash: invalidEvent.transactionHash,
          index: invalidEvent.logIndex,
        } as unknown as ethers.Log,
        // Valid event
        {
          blockNumber: validEvent.blockNumber,
          blockHash: "0x" + "0".repeat(64),
          transactionIndex: validEvent.transactionIndex,
          removed: false,
          address: validEvent.address,
          data: validEvent.data,
          topics: validEvent.topics as string[],
          transactionHash: validEvent.transactionHash,
          index: validEvent.logIndex,
        } as unknown as ethers.Log,
      ];

      mockProvider.getLogs.mockResolvedValue(ethersLogs);
      mockProvider.getBlock.mockResolvedValue({
        timestamp: validEvent.blockTimestamp,
      } as ethers.Block);
      mockProvider.getCode.mockResolvedValue("0x1234");

      // Act
      const result = await DistributorDetector.scanBlockRange(
        mockProvider,
        150,
        200,
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      });
    });

    it("should handle getBlock failures gracefully", async () => {
      // Arrange
      const event = testData.events[0]!;
      const ethersLog = {
        blockNumber: event.blockNumber,
        blockHash: "0x" + "0".repeat(64),
        transactionIndex: event.transactionIndex,
        removed: false,
        address: event.address,
        data: event.data,
        topics: event.topics as string[],
        transactionHash: event.transactionHash,
        index: event.logIndex,
      } as unknown as ethers.Log;

      mockProvider.getLogs.mockResolvedValue([ethersLog]);
      mockProvider.getBlock.mockRejectedValue(new Error("Block not found"));

      // Act
      const result = await DistributorDetector.scanBlockRange(
        mockProvider,
        150,
        200,
      );

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("integration with existing methods", () => {
    it("should properly integrate with parseDistributorCreation", async () => {
      // Arrange
      const event = testData.events[2]!; // L2_BASE_FEE event
      const ethersLog = {
        blockNumber: event.blockNumber,
        blockHash: "0x" + "0".repeat(64),
        transactionIndex: event.transactionIndex,
        removed: false,
        address: event.address,
        data: event.data,
        topics: event.topics as string[],
        transactionHash: event.transactionHash,
        index: event.logIndex,
      } as unknown as ethers.Log;

      mockProvider.getLogs.mockResolvedValue([ethersLog]);
      mockProvider.getBlock.mockResolvedValue({
        timestamp: event.blockTimestamp,
      } as ethers.Block);
      mockProvider.getCode.mockResolvedValue("0x1234");

      // Act
      const result = await DistributorDetector.scanBlockRange(
        mockProvider,
        680,
        690,
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: DistributorType.L2_BASE_FEE,
        block: 684,
        date: "2022-08-09",
        tx_hash:
          "0x966831a2207df808ffcc44c90c0e60bce86185fb73b18c962f4f1303eb54efa2",
        method: "0x57f585db",
        owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
        event_data: event.data,
        is_reward_distributor: false,
        distributor_address: "0xdff90519a9DE6ad469D4f9839a9220C5D340B792",
      });
    });

    it("should order results by block number", async () => {
      // Arrange: Use events in non-sequential order
      const events = [
        testData.events[2]!,
        testData.events[0]!,
        testData.events[1]!,
      ];
      const ethersLogs = events.map(
        (event) =>
          ({
            blockNumber: event.blockNumber,
            blockHash: "0x" + "0".repeat(64),
            transactionIndex: event.transactionIndex,
            removed: false,
            address: event.address,
            data: event.data,
            topics: event.topics as string[],
            transactionHash: event.transactionHash,
            index: event.logIndex,
          }) as unknown as ethers.Log,
      );

      mockProvider.getLogs.mockResolvedValue(ethersLogs);
      mockProvider.getBlock.mockImplementation(async (blockNumber) => {
        const event = testData.events.find(
          (e) => e.blockNumber === blockNumber,
        );
        return {
          timestamp: event?.blockTimestamp || 0,
        } as ethers.Block;
      });
      mockProvider.getCode.mockResolvedValue("0x1234");

      // Act
      const result = await DistributorDetector.scanBlockRange(
        mockProvider,
        150,
        700,
      );

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0]!.block).toBe(152);
      expect(result[1]!.block).toBe(153);
      expect(result[2]!.block).toBe(684);
    });
  });
});

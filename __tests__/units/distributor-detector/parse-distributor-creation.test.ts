import { DistributorDetector } from "../../../src/distributor-detector";
import { DistributorType } from "../../../src/types";
import { ethers } from "ethers";
import testData from "../../test-data/distributor-detector/distributor-creation-events-raw.json";
import { REWARD_DISTRIBUTOR_BYTECODE } from "../../../src/constants/reward-distributor-bytecode";

describe("DistributorDetector.parseDistributorCreation", () => {
  let mockProvider: jest.Mocked<ethers.Provider>;

  beforeEach(() => {
    mockProvider = {
      getCode: jest.fn(),
    } as unknown as jest.Mocked<ethers.Provider>;
  });

  describe("valid distributor creation events", () => {
    it("should parse L2_SURPLUS_FEE distributor creation event", async () => {
      const event = testData.events[0]!; // L2_SURPLUS_FEE event
      const log = {
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

      // Mock the provider to return non-reward distributor bytecode
      mockProvider.getCode.mockResolvedValue("0x1234");

      const result = await DistributorDetector.parseDistributorCreation(
        log,
        event.blockTimestamp,
        mockProvider,
      );

      expect(result).toEqual({
        type: DistributorType.L2_SURPLUS_FEE,
        block: 152,
        date: "2022-07-12",
        tx_hash:
          "0x6151c7f22d923b9a1ae3d0302b03e8cd2af70ee5792b26e10858d4de6b005fa9",
        method: "0xfcdde2b4",
        owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
        event_data: event.data,
        is_reward_distributor: false,
        distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      });

      expect(mockProvider.getCode).toHaveBeenCalledWith(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      );
    });

    it("should parse L1_SURPLUS_FEE distributor creation event", async () => {
      const event = testData.events[1]!; // L1_SURPLUS_FEE event
      const log = {
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

      // Mock the provider to return reward distributor bytecode
      mockProvider.getCode.mockResolvedValue(REWARD_DISTRIBUTOR_BYTECODE);

      const result = await DistributorDetector.parseDistributorCreation(
        log,
        event.blockTimestamp,
        mockProvider,
      );

      expect(result).toEqual({
        type: DistributorType.L1_SURPLUS_FEE,
        block: 153,
        date: "2022-07-12",
        tx_hash:
          "0xee038b7b30e9331447da4fe9effc81a4bcecf08d21f133162eb4cb3ac971e46a",
        method: "0x934be07d",
        owner: "0x9C040726F2A657226Ed95712245DeE84b650A1b5",
        event_data: event.data,
        is_reward_distributor: true,
        distributor_address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      });
    });

    it("should parse L2_BASE_FEE distributor creation event", async () => {
      const event = testData.events[2]!; // L2_BASE_FEE event
      const log = {
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

      // Mock the provider to return non-reward distributor bytecode
      mockProvider.getCode.mockResolvedValue("0x5678");

      const result = await DistributorDetector.parseDistributorCreation(
        log,
        event.blockTimestamp,
        mockProvider,
      );

      expect(result).toEqual({
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
  });

  describe("invalid events", () => {
    it("should throw error for non-distributor creation event", async () => {
      const log = {
        blockNumber: 100,
        blockHash: "0x" + "0".repeat(64),
        transactionIndex: 0,
        removed: false,
        address: "0x0000000000000000000000000000000000000070",
        data: "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000024deadbeef00000000000000000000000037daa99b1caae0c22670963e103a66ca2c5db2db00000000000000000000000000000000000000000000000000000000",
        topics: [
          "0x3c9e6a772755407311e3b35b3ee56799df8f87395941b3a658eee9e08a67ebda",
          "0xdeadbeef00000000000000000000000000000000000000000000000000000000", // unknown method
          "0x0000000000000000000000009c040726f2a657226ed95712245dee84b650a1b5",
        ],
        transactionHash: "0x" + "1".repeat(64),
        index: 0,
      } as unknown as ethers.Log;

      await expect(
        DistributorDetector.parseDistributorCreation(
          log,
          1657665955,
          mockProvider,
        ),
      ).rejects.toThrow("Unknown distributor method signature: 0xdeadbeef");
    });

    it("should throw error for malformed data field", async () => {
      const log = {
        blockNumber: 100,
        blockHash: "0x" + "0".repeat(64),
        transactionIndex: 0,
        removed: false,
        address: "0x0000000000000000000000000000000000000000000000000000000070",
        data: "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000004fcdde2b4", // data field with only method selector, no address
        topics: [
          "0x3c9e6a772755407311e3b35b3ee56799df8f87395941b3a658eee9e08a67ebda",
          "0xfcdde2b400000000000000000000000000000000000000000000000000000000",
          "0x0000000000000000000000009c040726f2a657226ed95712245dee84b650a1b5",
        ],
        transactionHash: "0x" + "1".repeat(64),
        index: 0,
      } as unknown as ethers.Log;

      await expect(
        DistributorDetector.parseDistributorCreation(
          log,
          1657665955,
          mockProvider,
        ),
      ).rejects.toThrow("Failed to decode distributor address from event data");
    });

    it("should throw error when log cannot be parsed", async () => {
      const log = {
        blockNumber: 100,
        blockHash: "0x" + "0".repeat(64),
        transactionIndex: 0,
        removed: false,
        address: "0x0000000000000000000000000000000000000070",
        data: "0x1234",
        topics: [
          "0xwrongEventSignature", // Wrong event signature
          "0xfcdde2b400000000000000000000000000000000000000000000000000000000",
        ],
        transactionHash: "0x" + "1".repeat(64),
        index: 0,
      } as unknown as ethers.Log;

      await expect(
        DistributorDetector.parseDistributorCreation(
          log,
          1657665955,
          mockProvider,
        ),
      ).rejects.toThrow("Failed to parse log as OwnerActs event");
    });

    it("should test valid address decoding with zero address", async () => {
      const log = {
        blockNumber: 100,
        blockHash: "0x" + "0".repeat(64),
        transactionIndex: 0,
        removed: false,
        address: "0x0000000000000000000000000000000000000070",
        data: "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000024fcdde2b40000000000000000000000000000000000000000000000000000000000000000", // Zero address
        topics: [
          "0x3c9e6a772755407311e3b35b3ee56799df8f87395941b3a658eee9e08a67ebda",
          "0xfcdde2b400000000000000000000000000000000000000000000000000000000",
          "0x0000000000000000000000009c040726f2a657226ed95712245dee84b650a1b5",
        ],
        transactionHash: "0x" + "1".repeat(64),
        index: 0,
      } as unknown as ethers.Log;

      // Mock the provider to return non-reward distributor bytecode
      mockProvider.getCode.mockResolvedValue("0x");

      const result = await DistributorDetector.parseDistributorCreation(
        log,
        1657665955,
        mockProvider,
      );

      // Should successfully decode zero address
      expect(result).toBeDefined();
      expect(result.distributor_address).toBe(
        "0x0000000000000000000000000000000000000000",
      );
      expect(mockProvider.getCode).toHaveBeenCalledWith(
        "0x0000000000000000000000000000000000000000",
      );
    });
  });
});

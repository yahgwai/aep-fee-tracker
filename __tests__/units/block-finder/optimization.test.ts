import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import { ethers } from "ethers";
import { BlockNumberData, FileManager } from "../../../src/types";
import { BlockFinder } from "../../../src/block-finder";
import {
  createProvider,
  instrumentProviderForCallTracking,
  ARBITRUM_NOVA_RPC_URL,
} from "./test-utils";

describe("BlockFinder - Optimization", () => {
  let provider: ethers.JsonRpcProvider;
  let blockFinder: BlockFinder;
  let tracking: ReturnType<typeof instrumentProviderForCallTracking>;

  const mockFileManager = {
    readBlockNumbers: jest.fn<() => BlockNumberData>(),
    writeBlockNumbers: jest.fn<(data: BlockNumberData) => void>(),
  };

  beforeEach(() => {
    provider = createProvider(ARBITRUM_NOVA_RPC_URL);
    tracking = instrumentProviderForCallTracking(provider);
    blockFinder = new BlockFinder(
      mockFileManager as unknown as FileManager,
      provider,
    );

    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (provider) {
      await provider.destroy();
    }
  });

  describe("findEndOfDayBlock optimization", () => {
    it("should not re-fetch the lower bound block when it's already known", async () => {
      // Setup: We have a known block for Jan 10
      const jan10EndBlock = 39039696;
      const jan11Date = new Date("2024-01-11");

      const existingData: BlockNumberData = {
        metadata: { chain_id: 42170 },
        blocks: {
          "2024-01-10": jan10EndBlock,
        },
      };

      mockFileManager.readBlockNumbers.mockReturnValue(existingData);

      // When searching for Jan 11 block, we use Jan 10 block as lower bound
      const lowerBound = jan10EndBlock; // This is the known block
      const upperBound = 39470096; // A block well into Jan 12 (past midnight)

      // Reset tracking to only count calls during findEndOfDayBlock
      tracking.resetTracking();

      // Act: Find end of day block for Jan 11
      await blockFinder.findEndOfDayBlock(
        jan11Date,
        lowerBound,
        upperBound,
        existingData,
      );

      // Assert: Check which blocks were requested
      const requestedBlocks = tracking.getRequestedBlocks();
      const callCount = tracking.getCallCount();

      // The optimization should prevent fetching the lower bound block (39039696)
      // Currently this test will fail because the implementation fetches both bounds
      expect(requestedBlocks).not.toContain(lowerBound);

      // We expect only the upper bound to be fetched initially, plus binary search calls
      // With the optimization, the first two calls (Promise.all) should only fetch upperBound
      const lowerBoundFetches = requestedBlocks.filter(
        (b) => b === lowerBound,
      ).length;
      expect(lowerBoundFetches).toBe(0);

      console.log(`Total block requests: ${callCount}`);
      console.log(`Blocks requested: ${requestedBlocks.join(", ")}`);
      console.log(
        `Lower bound (${lowerBound}) was fetched ${lowerBoundFetches} times`,
      );
    });
  });
});

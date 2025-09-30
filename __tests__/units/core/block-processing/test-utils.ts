import { ethers } from "ethers";
import { FileManager } from "../../../../src/types";
import { BlockFinder } from "../../../../src/core/block-processing/block-finder";

// Network configuration
export const ARBITRUM_NOVA_CHAIN_ID = 42170;
export const ARBITRUM_NOVA_RPC_URL = process.env[
  "ARBITRUM_NOVA_RPC_URL"
] as string;
export const NETWORK_CONFIG = {
  chainId: ARBITRUM_NOVA_CHAIN_ID,
  name: "arbitrum-nova",
};

// Test constants
export const INVALID_RPC = "https://invalid-rpc-url.com";
export const LOCALHOST_RPC = "http://localhost:9999";

// Provider creation helpers
export function createProvider(
  rpcUrl: string = process.env["ARBITRUM_NOVA_RPC_URL"] as string,
): ethers.JsonRpcProvider {
  const network = ethers.Network.from(NETWORK_CONFIG);
  return new ethers.JsonRpcProvider(rpcUrl, network, {
    staticNetwork: network,
  });
}

export function createMockProvider(
  rpcUrl: string = process.env["ARBITRUM_NOVA_RPC_URL"] as string,
): ethers.JsonRpcProvider {
  return createProvider(rpcUrl);
}

// BlockFinder creation helpers
export function createBlockFinder(
  fileManager: FileManager,
  provider: ethers.JsonRpcProvider,
): BlockFinder {
  return new BlockFinder(fileManager, provider);
}

export function createBlockFinderWithMockFileManager(
  provider: ethers.JsonRpcProvider,
): BlockFinder {
  const dummyFileManager = {} as FileManager;
  return new BlockFinder(dummyFileManager, provider);
}

// Error expectation helper
export async function expectError(
  operation: () => Promise<unknown>,
): Promise<unknown> {
  try {
    await operation();
    throw new Error("Should have thrown");
  } catch (error) {
    return error;
  }
}

// Provider instrumentation for call tracking
export function instrumentProviderForCallTracking(
  provider: ethers.JsonRpcProvider,
): {
  getCallCount: () => number;
  getRequestedBlocks: () => number[];
  resetTracking: () => void;
} {
  let callCount = 0;
  const requestedBlocks: number[] = [];
  const original = provider.getBlock.bind(provider);

  provider.getBlock = async function (
    ...args: Parameters<typeof provider.getBlock>
  ) {
    callCount++;
    const blockTag = args[0];
    if (typeof blockTag === "number") {
      requestedBlocks.push(blockTag);
    }
    return original(...args);
  };

  return {
    getCallCount: () => callCount,
    getRequestedBlocks: () => [...requestedBlocks],
    resetTracking: () => {
      callCount = 0;
      requestedBlocks.length = 0;
    },
  };
}

// Known test blocks data
export const TEST_BLOCKS = {
  "2024-01-09": 38827575,
  "2024-01-10": 39039696,
  "2024-01-11": 39254896,
  "2024-01-12": 39470096,
  "2024-01-13": 39685296,
  "2024-01-15": 40268100,
  "2024-01-16": 40345600,
  "2024-01-17": 40691200,
};

// Common test date helpers
export function createTestDate(dateString: string): Date {
  return new Date(dateString);
}

export function getDateRange(startStr: string, endStr: string): [Date, Date] {
  return [new Date(startStr), new Date(endStr)];
}

// Mock provider configuration
const MOCK_GENESIS_DATE = new Date("2022-01-01T00:00:00Z");
const MOCK_GENESIS_BLOCK = 1;
const MOCK_BLOCKS_PER_SECOND = 4;
// ~3 years of blocks at 4 blocks/second = 3 * 365 * 24 * 60 * 60 * 4 ≈ 378M blocks
const MOCK_CURRENT_BLOCK = 380000000;

/**
 * Calculate a deterministic timestamp for a given block number
 * Starting from Jan 1, 2022 with 4 blocks per second
 */
export function calculateBlockTimestamp(blockNumber: number): number {
  const blocksSinceGenesis = blockNumber - MOCK_GENESIS_BLOCK;
  const secondsSinceGenesis = blocksSinceGenesis / MOCK_BLOCKS_PER_SECOND;
  const genesisTimestamp = Math.floor(MOCK_GENESIS_DATE.getTime() / 1000);
  return Math.floor(genesisTimestamp + secondsSinceGenesis);
}

/**
 * Find the approximate block number for a given timestamp
 * Inverse of calculateBlockTimestamp - useful for binary search starting point
 */
export function estimateBlockForTimestamp(timestamp: number): number {
  const genesisTimestamp = Math.floor(MOCK_GENESIS_DATE.getTime() / 1000);
  const secondsSinceGenesis = timestamp - genesisTimestamp;
  const blocksSinceGenesis = Math.floor(
    secondsSinceGenesis * MOCK_BLOCKS_PER_SECOND,
  );
  return MOCK_GENESIS_BLOCK + blocksSinceGenesis;
}

export interface MockProviderOptions {
  trackCalls?: boolean;
  currentBlock?: number;
  chainId?: number;
  failAfterNCalls?: number;
  delayMs?: number;
}

/**
 * Create a mock provider for testing without real network calls.
 *
 * Usage: Create a new instance for each test to ensure isolation.
 * Each instance maintains its own call tracking state.
 *
 * Example:
 *   const provider = createMockedProvider();
 *   const block = await provider.getBlock(123456);
 *   const callCount = provider._getCallCount();
 *
 * Thread Safety: Safe for parallel test execution when each test
 * creates its own instance. Do NOT share instances between tests.
 */
export function createMockedProvider(options: MockProviderOptions = {}) {
  const {
    trackCalls = true,
    currentBlock = MOCK_CURRENT_BLOCK,
    chainId = ARBITRUM_NOVA_CHAIN_ID,
    failAfterNCalls,
    delayMs = 0,
  } = options;

  let callCount = 0;
  const requestedBlocks: number[] = [];
  const callLog: { method: string; params: unknown[]; timestamp: number }[] =
    [];

  const mockProvider = {
    async getNetwork() {
      if (trackCalls) {
        callLog.push({
          method: "getNetwork",
          params: [],
          timestamp: Date.now(),
        });
      }
      if (delayMs > 0)
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      return {
        chainId: BigInt(chainId),
        name: "arbitrum-nova",
      };
    },

    async getBlockNumber() {
      if (trackCalls) {
        callLog.push({
          method: "getBlockNumber",
          params: [],
          timestamp: Date.now(),
        });
      }
      if (delayMs > 0)
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      return currentBlock;
    },

    async getBlock(blockTag: number | string) {
      callCount++;

      if (failAfterNCalls && callCount > failAfterNCalls) {
        throw new Error(`Simulated RPC error after ${failAfterNCalls} calls`);
      }

      if (typeof blockTag === "string" && blockTag === "latest") {
        blockTag = currentBlock;
      }

      const blockNumber =
        typeof blockTag === "number"
          ? blockTag
          : parseInt(blockTag as string, 10);

      if (trackCalls) {
        requestedBlocks.push(blockNumber);
        callLog.push({
          method: "getBlock",
          params: [blockNumber],
          timestamp: Date.now(),
        });
      }

      if (delayMs > 0)
        await new Promise((resolve) => setTimeout(resolve, delayMs));

      if (blockNumber > currentBlock || blockNumber < 1) {
        return null;
      }

      return {
        number: blockNumber,
        timestamp: calculateBlockTimestamp(blockNumber),
        hash: `0x${blockNumber.toString(16).padStart(64, "0")}`,
      };
    },

    async destroy() {
      // No-op for mock
    },

    // Tracking utilities
    _getCallCount: () => callCount,
    _getRequestedBlocks: () => [...requestedBlocks],
    _getCallLog: () => [...callLog],
    _resetTracking: () => {
      callCount = 0;
      requestedBlocks.length = 0;
      callLog.length = 0;
    },
    _getBlocksRequestedAfter: (blockNumber: number) =>
      requestedBlocks.filter((b) => b > blockNumber),
    _getBlocksRequestedInRange: (start: number, end: number) =>
      requestedBlocks.filter((b) => b >= start && b <= end),
  };

  // Cast to JsonRpcProvider type for compatibility
  return mockProvider as unknown as ethers.JsonRpcProvider & {
    _getCallCount: () => number;
    _getRequestedBlocks: () => number[];
    _getCallLog: () => {
      method: string;
      params: unknown[];
      timestamp: number;
    }[];
    _resetTracking: () => void;
    _getBlocksRequestedAfter: (blockNumber: number) => number[];
    _getBlocksRequestedInRange: (start: number, end: number) => number[];
  };
}

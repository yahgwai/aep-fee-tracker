import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
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

interface BlockTimestampEntry {
  blockNumber: number;
  timestamp: number; // Unix timestamp in seconds
}

/**
 * Create a sorted array of block-timestamp pairs from block_numbers.json.
 * Each timestamp is set to 1 second before midnight UTC for that date.
 */
function createBlockTimestampMap(
  blocks: Record<string, number>,
): BlockTimestampEntry[] {
  const entries: BlockTimestampEntry[] = [];

  for (const [dateStr, blockNumber] of Object.entries(blocks)) {
    const date = new Date(dateStr);
    date.setUTCHours(23, 59, 59, 0);

    entries.push({
      blockNumber,
      timestamp: Math.floor(date.getTime() / 1000),
    });
  }

  return entries.sort((a, b) => a.blockNumber - b.blockNumber);
}

/**
 * Interpolate timestamp for any block number based on known daily end blocks.
 * Uses linear interpolation between the nearest known blocks.
 */
function interpolateBlockTimestamp(
  blockNumber: number,
  blockTimestampMap: BlockTimestampEntry[],
): number {
  if (blockTimestampMap.length === 0) {
    return calculateBlockTimestamp(blockNumber);
  }

  const firstEntry = blockTimestampMap[0];
  const lastEntry = blockTimestampMap[blockTimestampMap.length - 1];

  if (!firstEntry || !lastEntry) {
    return calculateBlockTimestamp(blockNumber);
  }

  if (blockNumber <= firstEntry.blockNumber) {
    return firstEntry.timestamp;
  }

  if (blockNumber >= lastEntry.blockNumber) {
    return lastEntry.timestamp;
  }

  let lower = 0;
  let upper = blockTimestampMap.length - 1;

  while (lower < upper - 1) {
    const mid = Math.floor((lower + upper) / 2);
    const midEntry = blockTimestampMap[mid];
    if (!midEntry) break;

    if (midEntry.blockNumber <= blockNumber) {
      lower = mid;
    } else {
      upper = mid;
    }
  }

  const lowerEntry = blockTimestampMap[lower];
  const upperEntry = blockTimestampMap[upper];

  if (!lowerEntry || !upperEntry) {
    return calculateBlockTimestamp(blockNumber);
  }

  const blockRange = upperEntry.blockNumber - lowerEntry.blockNumber;
  const timeRange = upperEntry.timestamp - lowerEntry.timestamp;
  const blockOffset = blockNumber - lowerEntry.blockNumber;

  const interpolatedTime =
    lowerEntry.timestamp + Math.floor((blockOffset / blockRange) * timeRange);

  return interpolatedTime;
}

/**
 * Load all recipient event test data from test-data directory.
 * Returns a Map keyed by lowercase contract addresses.
 */
function loadRecipientEventTestData(): Map<string, ethers.Log[]> {
  const eventData = new Map<string, ethers.Log[]>();
  const testDataDir = path.join(
    __dirname,
    "../../test-data/recipient-recieved",
  );

  // Check if directory exists
  if (!fs.existsSync(testDataDir)) {
    return eventData;
  }

  const files = fs
    .readdirSync(testDataDir)
    .filter((f) => f.endsWith(".json") && !f.includes("README"));

  for (const file of files) {
    const filePath = path.join(testDataDir, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

      if (!data.events || data.events.length === 0) {
        continue;
      }

      const logs: ethers.Log[] = data.events.map(
        (event: {
          blockNumber: number;
          address: string;
          data: string;
          topics: string[];
          transactionHash: string;
          logIndex: number;
        }) => ({
          blockNumber: event.blockNumber,
          blockHash: `0x${event.blockNumber.toString(16).padStart(64, "0")}`,
          transactionIndex: 0,
          removed: false,
          address: event.address,
          data: event.data,
          topics: event.topics,
          transactionHash: event.transactionHash,
          index: event.logIndex,
        }),
      );

      const address = data.distributor_address.toLowerCase();
      eventData.set(address, logs);
    } catch {
      continue;
    }
  }

  return eventData;
}

export interface MockProviderOptions {
  trackCalls?: boolean;
  currentBlock?: number;
  chainId?: number;
  failAfterNCalls?: number;
  delayMs?: number;
  loadEventData?: boolean; // Auto-load test data when true
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
    loadEventData = false,
  } = options;

  let callCount = 0;
  const requestedBlocks: number[] = [];
  const callLog: { method: string; params: unknown[]; timestamp: number }[] =
    [];

  const eventData = loadEventData ? loadRecipientEventTestData() : null;

  let blockTimestampMap: BlockTimestampEntry[] | null = null;
  if (loadEventData) {
    const blockNumbersPath = path.join(
      __dirname,
      "../../test-data/distributor-detector/block_numbers.json",
    );
    if (fs.existsSync(blockNumbersPath)) {
      try {
        const blockNumbersData = JSON.parse(
          fs.readFileSync(blockNumbersPath, "utf8"),
        );
        blockTimestampMap = createBlockTimestampMap(blockNumbersData.blocks);
      } catch {
        blockTimestampMap = null;
      }
    }
  }

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

      const timestamp = blockTimestampMap
        ? interpolateBlockTimestamp(blockNumber, blockTimestampMap)
        : calculateBlockTimestamp(blockNumber);

      return {
        number: blockNumber,
        timestamp,
        hash: `0x${blockNumber.toString(16).padStart(64, "0")}`,
      };
    },

    async getLogs(filter: ethers.Filter) {
      callCount++;

      if (failAfterNCalls && callCount > failAfterNCalls) {
        throw new Error(`Simulated RPC error after ${failAfterNCalls} calls`);
      }

      if (trackCalls) {
        callLog.push({
          method: "getLogs",
          params: [filter],
          timestamp: Date.now(),
        });
      }

      if (delayMs > 0)
        await new Promise((resolve) => setTimeout(resolve, delayMs));

      if (!eventData || eventData.size === 0) {
        return [];
      }

      const normalizeBlockTag = (tag: ethers.BlockTag | undefined): number => {
        if (tag === undefined || tag === null) return 0;
        if (typeof tag === "string") {
          if (tag === "latest") return currentBlock;
          if (tag === "earliest") return 0;
          return parseInt(tag, 16);
        }
        return tag as number;
      };

      const addresses: string[] = [];
      if (filter.address) {
        if (Array.isArray(filter.address)) {
          addresses.push(
            ...filter.address.map((a) => a.toString().toLowerCase()),
          );
        } else {
          addresses.push(filter.address.toString().toLowerCase());
        }
      } else {
        addresses.push(...Array.from(eventData.keys()));
      }

      const allLogs: ethers.Log[] = [];
      for (const addr of addresses) {
        const logs = eventData.get(addr);
        if (logs) {
          allLogs.push(...logs);
        }
      }

      const fromBlock = normalizeBlockTag(filter.fromBlock);
      const toBlock = normalizeBlockTag(filter.toBlock) || currentBlock;

      const filteredLogs = allLogs.filter(
        (log) => log.blockNumber >= fromBlock && log.blockNumber <= toBlock,
      );

      filteredLogs.sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) {
          return a.blockNumber - b.blockNumber;
        }
        return a.index - b.index;
      });

      return filteredLogs;
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

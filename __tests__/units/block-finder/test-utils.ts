import { ethers } from "ethers";
import { FileManager } from "../../../src/types";
import { BlockFinder } from "../../../src/block-finder";

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

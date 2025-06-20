import { CONTRACTS, DISTRIBUTOR_METHODS } from "../types";

// Re-export from types for backward compatibility
export const ARBOWNER_PRECOMPILE_ADDRESS = CONTRACTS.ARB_OWNER;
export const DISTRIBUTOR_METHOD_SIGNATURES = DISTRIBUTOR_METHODS;

// OwnerActs event signature
// event OwnerActs(bytes4 indexed method, address indexed owner, bytes data)
export const OWNER_ACTS_EVENT_SIGNATURE =
  "0x3c9e6a772755407311e3b35b3ee56799df8f87395941b3a658eee9e08a67ebda" as const;

// Helper function to pad method signature to 32 bytes for topics filtering
function padMethodSignature(methodSig: string): string {
  // Remove 0x prefix, pad to 64 chars, add 0x prefix back
  const cleanSig = methodSig.replace(/^0x/, "");
  return "0x" + cleanSig.padEnd(64, "0");
}

// Array of all distributor method signatures for filtering
export const ALL_DISTRIBUTOR_METHOD_SIGNATURES = [
  DISTRIBUTOR_METHODS.L2_BASE_FEE,
  DISTRIBUTOR_METHODS.L2_SURPLUS_FEE,
  DISTRIBUTOR_METHODS.L1_SURPLUS_FEE,
] as const;

// Array of padded method signatures for topics filtering
export const ALL_DISTRIBUTOR_METHOD_SIGNATURES_PADDED = [
  padMethodSignature(DISTRIBUTOR_METHODS.L2_BASE_FEE),
  padMethodSignature(DISTRIBUTOR_METHODS.L2_SURPLUS_FEE),
  padMethodSignature(DISTRIBUTOR_METHODS.L1_SURPLUS_FEE),
] as const;

// OwnerActs event ABI for parsing
export const OWNER_ACTS_EVENT_ABI = [
  "event OwnerActs(bytes4 indexed method, address indexed owner, bytes data)",
] as const;

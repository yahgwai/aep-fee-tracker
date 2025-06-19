import { CONTRACTS, DISTRIBUTOR_METHODS } from "../types";

// Re-export from types for backward compatibility
export const ARBOWNER_PRECOMPILE_ADDRESS = CONTRACTS.ARB_OWNER;
export const DISTRIBUTOR_METHOD_SIGNATURES = DISTRIBUTOR_METHODS;

// OwnerActs event signature
// event OwnerActs(bytes4 indexed method, address indexed owner, bytes data)
export const OWNER_ACTS_EVENT_SIGNATURE =
  "0x3c9e6a772755407311e3b35b3ee56799df8f87395941b3a658eee9e08a67ebda" as const;

// Array of all distributor method signatures for filtering
export const ALL_DISTRIBUTOR_METHOD_SIGNATURES = [
  DISTRIBUTOR_METHODS.L2_BASE_FEE,
  DISTRIBUTOR_METHODS.L2_SURPLUS_FEE,
  DISTRIBUTOR_METHODS.L1_SURPLUS_FEE,
] as const;

// OwnerActs event ABI for parsing
export const OWNER_ACTS_EVENT_ABI = [
  "event OwnerActs(bytes4 indexed method, address indexed owner, bytes data)",
] as const;

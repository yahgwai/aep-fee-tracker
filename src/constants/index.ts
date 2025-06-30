// Distributor method signatures
export const DISTRIBUTOR_METHODS = {
  L2_BASE_FEE: "0x57f585db",
  L2_SURPLUS_FEE: "0xfcdde2b4",
  L1_SURPLUS_FEE: "0x934be07d",
} as const;

export type DistributorMethod =
  (typeof DISTRIBUTOR_METHODS)[keyof typeof DISTRIBUTOR_METHODS];

// Contract addresses
export const CONTRACTS = {
  ARB_OWNER: "0x0000000000000000000000000000000000000070",
  ARB_INFO: "0x000000000000000000000000000000000000006D",
} as const;

// Chain IDs
export const CHAIN_IDS = {
  ARBITRUM_NOVA: 42170,
} as const;

// Block processing constants
export const SAFE_BLOCK_OFFSET = 100;

// Directory constants
export const STORE_DIR = "store";
export const DISTRIBUTORS_DIR = "distributors";

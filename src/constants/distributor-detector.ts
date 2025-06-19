// ArbOwner precompile address on Arbitrum Nova
export const ARBOWNER_PRECOMPILE_ADDRESS =
  "0x0000000000000000000000000000000000000070" as const;

// OwnerActs event signature
// event OwnerActs(bytes4 indexed method, address indexed owner, bytes data)
export const OWNER_ACTS_EVENT_SIGNATURE =
  "0x3c9e6a772755407311e3b35b3ee56799df8f87395941b3a658eee9e08a67ebda" as const;

// Method signatures for distributor creation
export const DISTRIBUTOR_METHOD_SIGNATURES = {
  L2_BASE_FEE: "0x57f585db", // setL2BaseFeeRewardRecipient
  L2_SURPLUS_FEE: "0xfcdde2b4", // setL2SurplusFeeRewardRecipient
  L1_SURPLUS_FEE: "0x934be07d", // setL1SurplusFeeRewardRecipient
} as const;

// Array of all distributor method signatures for filtering
export const ALL_DISTRIBUTOR_METHOD_SIGNATURES = [
  DISTRIBUTOR_METHOD_SIGNATURES.L2_BASE_FEE,
  DISTRIBUTOR_METHOD_SIGNATURES.L2_SURPLUS_FEE,
  DISTRIBUTOR_METHOD_SIGNATURES.L1_SURPLUS_FEE,
] as const;

// OwnerActs event ABI for parsing
export const OWNER_ACTS_EVENT_ABI = [
  "event OwnerActs(bytes4 indexed method, address indexed owner, bytes data)",
] as const;

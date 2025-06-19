/**
 * ArbOwner precompile address on Arbitrum Nova
 * This contract manages administrative functions including reward distributor creation
 */
export const ARBOWNER_ADDRESS =
  "0x0000000000000000000000000000000000000070" as const;

/**
 * Keccak256 hash of the OwnerActs event signature: "OwnerActs(bytes4,address,bytes)"
 * This event is emitted when ArbOwner performs administrative actions
 */
export const OWNER_ACTS_EVENT_TOPIC =
  "0x3c9e6a772755407311e3b35b3ee56799df8f87395941b3a658eee9e08a67ebda" as const;

/**
 * Method signatures for distributor creation functions
 * These signatures identify which type of distributor is being created in OwnerActs events
 *
 * @property L2_BASE_FEE - setL2BaseFeeRewardRecipient method signature
 * @property L2_SURPLUS_FEE - setL2SurplusFeeRewardRecipient method signature
 * @property L1_SURPLUS_FEE - setL1SurplusFeeRewardRecipient method signature
 */
export const DISTRIBUTOR_CREATION_METHODS = {
  L2_BASE_FEE: "0x57f585db",
  L2_SURPLUS_FEE: "0xfcdde2b4",
  L1_SURPLUS_FEE: "0x934be07d",
} as const;

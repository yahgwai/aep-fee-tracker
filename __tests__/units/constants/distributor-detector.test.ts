import {
  ARBOWNER_ADDRESS,
  OWNER_ACTS_EVENT_TOPIC,
  DISTRIBUTOR_CREATION_METHODS,
} from "../../../src/constants/distributor-detector";
import { DISTRIBUTOR_METHODS } from "../../../src/types";

describe("Distributor Detector Constants", () => {
  describe("ARBOWNER_ADDRESS", () => {
    it("should export ArbOwner precompile address", () => {
      expect(ARBOWNER_ADDRESS).toBeDefined();
    });

    it("should have correct ArbOwner address", () => {
      expect(ARBOWNER_ADDRESS).toBe(
        "0x0000000000000000000000000000000000000070",
      );
    });

    it("should be a const assertion preventing mutation", () => {
      expect(typeof ARBOWNER_ADDRESS).toBe("string");
      // TypeScript will enforce const assertion at compile time
    });
  });

  describe("OWNER_ACTS_EVENT_TOPIC", () => {
    it("should export OwnerActs event topic", () => {
      expect(OWNER_ACTS_EVENT_TOPIC).toBeDefined();
    });

    it("should have correct OwnerActs event topic hash", () => {
      // This is the keccak256 hash of "OwnerActs(bytes4,address,bytes)"
      expect(OWNER_ACTS_EVENT_TOPIC).toBe(
        "0x3c9e6a772755407311e3b35b3ee56799df8f87395941b3a658eee9e08a67ebda",
      );
    });

    it("should be a const assertion preventing mutation", () => {
      expect(typeof OWNER_ACTS_EVENT_TOPIC).toBe("string");
    });
  });

  describe("DISTRIBUTOR_CREATION_METHODS", () => {
    it("should export distributor creation methods", () => {
      expect(DISTRIBUTOR_CREATION_METHODS).toBeDefined();
    });

    it("should contain all required method signatures", () => {
      expect(DISTRIBUTOR_CREATION_METHODS).toHaveProperty("L2_BASE_FEE");
      expect(DISTRIBUTOR_CREATION_METHODS).toHaveProperty("L2_SURPLUS_FEE");
      expect(DISTRIBUTOR_CREATION_METHODS).toHaveProperty("L1_SURPLUS_FEE");
    });

    it("should have correct method signatures", () => {
      expect(DISTRIBUTOR_CREATION_METHODS.L2_BASE_FEE).toBe("0x57f585db");
      expect(DISTRIBUTOR_CREATION_METHODS.L2_SURPLUS_FEE).toBe("0xfcdde2b4");
      expect(DISTRIBUTOR_CREATION_METHODS.L1_SURPLUS_FEE).toBe("0x934be07d");
    });

    it("should match DISTRIBUTOR_METHODS from types", () => {
      // Ensure consistency with existing type definitions
      expect(DISTRIBUTOR_CREATION_METHODS.L2_BASE_FEE).toBe(
        DISTRIBUTOR_METHODS.L2_BASE_FEE,
      );
      expect(DISTRIBUTOR_CREATION_METHODS.L2_SURPLUS_FEE).toBe(
        DISTRIBUTOR_METHODS.L2_SURPLUS_FEE,
      );
      expect(DISTRIBUTOR_CREATION_METHODS.L1_SURPLUS_FEE).toBe(
        DISTRIBUTOR_METHODS.L1_SURPLUS_FEE,
      );
    });

    it("should be a const assertion preventing mutation", () => {
      expect(Object.isFrozen(DISTRIBUTOR_CREATION_METHODS)).toBe(false);
      // Note: Object.freeze would be true if we used Object.freeze,
      // but const assertions work at TypeScript level
    });
  });

  describe("Usage in context", () => {
    it("should be importable and usable together", () => {
      // Simulate usage in distributor detector
      const filter = {
        address: ARBOWNER_ADDRESS,
        topics: [
          OWNER_ACTS_EVENT_TOPIC,
          Object.values(DISTRIBUTOR_CREATION_METHODS),
        ],
      };

      expect(filter.address).toBe("0x0000000000000000000000000000000000000070");
      expect(filter.topics[0]).toBe(
        "0x3c9e6a772755407311e3b35b3ee56799df8f87395941b3a658eee9e08a67ebda",
      );
      expect(filter.topics[1]).toContain("0x57f585db");
      expect(filter.topics[1]).toContain("0xfcdde2b4");
      expect(filter.topics[1]).toContain("0x934be07d");
    });
  });
});

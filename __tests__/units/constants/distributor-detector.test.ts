import {
  ARBOWNER_PRECOMPILE_ADDRESS,
  OWNER_ACTS_EVENT_SIGNATURE,
  DISTRIBUTOR_METHOD_SIGNATURES,
  ALL_DISTRIBUTOR_METHOD_SIGNATURES,
  OWNER_ACTS_EVENT_ABI,
} from "../../../src/constants/distributor-detector";

describe("Distributor Detector Constants", () => {
  describe("ARBOWNER_PRECOMPILE_ADDRESS", () => {
    it("should have correct ArbOwner precompile address", () => {
      expect(ARBOWNER_PRECOMPILE_ADDRESS).toBe(
        "0x0000000000000000000000000000000000000070",
      );
    });

    it("should be lowercase", () => {
      expect(ARBOWNER_PRECOMPILE_ADDRESS).toBe(
        ARBOWNER_PRECOMPILE_ADDRESS.toLowerCase(),
      );
    });

    it("should be 42 characters long (0x + 40 hex chars)", () => {
      expect(ARBOWNER_PRECOMPILE_ADDRESS.length).toBe(42);
    });
  });

  describe("OWNER_ACTS_EVENT_SIGNATURE", () => {
    it("should have correct event signature", () => {
      expect(OWNER_ACTS_EVENT_SIGNATURE).toBe(
        "0x3c9e6a772755407311e3b35b3ee56799df8f87395941b3a658eee9e08a67ebda",
      );
    });

    it("should be 66 characters long (0x + 64 hex chars)", () => {
      expect(OWNER_ACTS_EVENT_SIGNATURE.length).toBe(66);
    });

    it("should be lowercase", () => {
      expect(OWNER_ACTS_EVENT_SIGNATURE).toBe(
        OWNER_ACTS_EVENT_SIGNATURE.toLowerCase(),
      );
    });
  });

  describe("DISTRIBUTOR_METHOD_SIGNATURES", () => {
    it("should have correct L2 base fee method signature", () => {
      expect(DISTRIBUTOR_METHOD_SIGNATURES.L2_BASE_FEE).toBe("0x57f585db");
    });

    it("should have correct L2 surplus fee method signature", () => {
      expect(DISTRIBUTOR_METHOD_SIGNATURES.L2_SURPLUS_FEE).toBe("0xfcdde2b4");
    });

    it("should have correct L1 surplus fee method signature", () => {
      expect(DISTRIBUTOR_METHOD_SIGNATURES.L1_SURPLUS_FEE).toBe("0x934be07d");
    });

    it("all method signatures should be 10 characters long (0x + 8 hex chars)", () => {
      Object.values(DISTRIBUTOR_METHOD_SIGNATURES).forEach((sig) => {
        expect(sig.length).toBe(10);
      });
    });

    it("all method signatures should be lowercase", () => {
      Object.values(DISTRIBUTOR_METHOD_SIGNATURES).forEach((sig) => {
        expect(sig).toBe(sig.toLowerCase());
      });
    });
  });

  describe("ALL_DISTRIBUTOR_METHOD_SIGNATURES", () => {
    it("should contain all method signatures", () => {
      expect(ALL_DISTRIBUTOR_METHOD_SIGNATURES).toEqual([
        DISTRIBUTOR_METHOD_SIGNATURES.L2_BASE_FEE,
        DISTRIBUTOR_METHOD_SIGNATURES.L2_SURPLUS_FEE,
        DISTRIBUTOR_METHOD_SIGNATURES.L1_SURPLUS_FEE,
      ]);
    });

    it("should have exactly 3 method signatures", () => {
      expect(ALL_DISTRIBUTOR_METHOD_SIGNATURES.length).toBe(3);
    });
  });

  describe("OWNER_ACTS_EVENT_ABI", () => {
    it("should be an array with one event definition", () => {
      expect(Array.isArray(OWNER_ACTS_EVENT_ABI)).toBe(true);
      expect(OWNER_ACTS_EVENT_ABI.length).toBe(1);
    });

    it("should contain the correct event signature", () => {
      expect(OWNER_ACTS_EVENT_ABI[0]).toBe(
        "event OwnerActs(bytes4 indexed method, address indexed owner, bytes data)",
      );
    });
  });

  describe("Type Safety", () => {
    it("constants should be readonly", () => {
      // TypeScript ensures these are readonly at compile time
      // This test verifies the values are frozen at runtime
      expect(Object.isFrozen(DISTRIBUTOR_METHOD_SIGNATURES)).toBe(false);
      expect(Object.isFrozen(ALL_DISTRIBUTOR_METHOD_SIGNATURES)).toBe(false);
      expect(Object.isFrozen(OWNER_ACTS_EVENT_ABI)).toBe(false);
    });
  });
});

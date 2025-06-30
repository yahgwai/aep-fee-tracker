import { DistributorDetector } from "../../../../src/core/distributor-detection/distributor-detector";
import { DistributorType } from "../../../../src/types";
import { DISTRIBUTOR_METHODS } from "../../../../src/constants";

describe("DistributorDetector.getDistributorType", () => {
  describe("Method signature mapping", () => {
    it("returns L2_BASE_FEE for setL2BaseFeeRewardRecipient signature", () => {
      const result = DistributorDetector.getDistributorType(
        DISTRIBUTOR_METHODS.L2_BASE_FEE,
      );
      expect(result).toBe(DistributorType.L2_BASE_FEE);
    });

    it("returns L2_SURPLUS_FEE for setL2SurplusFeeRewardRecipient signature", () => {
      const result = DistributorDetector.getDistributorType(
        DISTRIBUTOR_METHODS.L2_SURPLUS_FEE,
      );
      expect(result).toBe(DistributorType.L2_SURPLUS_FEE);
    });

    it("returns L1_SURPLUS_FEE for setL1SurplusFeeRewardRecipient signature", () => {
      const result = DistributorDetector.getDistributorType(
        DISTRIBUTOR_METHODS.L1_SURPLUS_FEE,
      );
      expect(result).toBe(DistributorType.L1_SURPLUS_FEE);
    });
  });

  describe("Unknown signatures", () => {
    it("returns null for unknown method signature", () => {
      const result = DistributorDetector.getDistributorType("0x12345678");
      expect(result).toBeNull();
    });
  });
});

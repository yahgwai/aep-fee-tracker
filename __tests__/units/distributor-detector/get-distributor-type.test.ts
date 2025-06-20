import { DistributorDetector } from "../../../src/distributor-detector";
import { DistributorType, DISTRIBUTOR_METHODS } from "../../../src/types";

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
});

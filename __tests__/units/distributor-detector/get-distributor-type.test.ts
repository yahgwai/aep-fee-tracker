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
  });
});

import { DistributorType, DISTRIBUTOR_METHODS } from "./types";

export class DistributorDetector {
  static getDistributorType(methodSignature: string): DistributorType | null {
    switch (methodSignature) {
      case DISTRIBUTOR_METHODS.L2_BASE_FEE:
        return DistributorType.L2_BASE_FEE;
      case DISTRIBUTOR_METHODS.L2_SURPLUS_FEE:
        return DistributorType.L2_SURPLUS_FEE;
      case DISTRIBUTOR_METHODS.L1_SURPLUS_FEE:
        return DistributorType.L1_SURPLUS_FEE;
      default:
        return null;
    }
  }
}

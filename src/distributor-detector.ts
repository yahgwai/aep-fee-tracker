import { DistributorType } from "./types";

export class DistributorDetector {
  static getDistributorType(methodSignature: string): DistributorType | null {
    if (methodSignature === "0x57f585db") {
      return DistributorType.L2_BASE_FEE;
    }
    return DistributorType.L2_SURPLUS_FEE;
  }
}

import { DistributorType } from "./types";

export class DistributorDetector {
  static getDistributorType(methodSignature: string): DistributorType | null {
    void methodSignature; // Minimal implementation - ignore parameter for now
    return DistributorType.L2_BASE_FEE;
  }
}

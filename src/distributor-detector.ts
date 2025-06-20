import { DistributorType } from "./types";

export class DistributorDetector {
  static getDistributorType(methodSignature: string): DistributorType | null {
    // Suppress unused variable warning for TDD stub
    void methodSignature;
    throw new Error("Not implemented");
  }
}

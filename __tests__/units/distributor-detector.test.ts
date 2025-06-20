import { DistributorDetector } from "../../src/distributor-detector";
import { FileManager } from "../../src/file-manager";
import { ethers } from "ethers";

describe("DistributorDetector", () => {
  let mockFileManager: FileManager;
  let mockProvider: ethers.Provider;

  beforeEach(() => {
    mockFileManager = new FileManager("test-store");
    mockProvider = new ethers.JsonRpcProvider();
  });

  describe("constructor", () => {
    it("should create an instance with FileManager and Provider", () => {
      const detector = new DistributorDetector(mockFileManager, mockProvider);

      expect(detector).toBeInstanceOf(DistributorDetector);
    });

    it("should accept FileManager and Provider as constructor parameters", () => {
      // This test verifies the constructor signature
      // The fact that it compiles and runs without error proves the parameters are accepted
      expect(
        () => new DistributorDetector(mockFileManager, mockProvider),
      ).not.toThrow();
    });

    it("should be properly typed to require both FileManager and Provider", () => {
      // This test verifies TypeScript typing by using @ts-expect-error
      // If these lines compile without the @ts-expect-error, the test should fail

      // @ts-expect-error - Constructor requires two parameters
      new DistributorDetector();

      // @ts-expect-error - Constructor requires Provider as second parameter
      new DistributorDetector(mockFileManager);

      // This line should compile without error
      new DistributorDetector(mockFileManager, mockProvider);
    });
  });
});

import { ethers } from "ethers";
import { FileManager } from "../../src/file-manager";
import { BalanceFetcher } from "../../src/balance-fetcher";

jest.mock("../../src/file-manager");

describe("BalanceFetcher", () => {
  let mockFileManager: jest.Mocked<FileManager>;
  let mockProvider: jest.Mocked<ethers.Provider>;

  beforeEach(() => {
    mockFileManager = {} as jest.Mocked<FileManager>;
    mockProvider = {} as jest.Mocked<ethers.Provider>;
  });

  describe("constructor", () => {
    it("can be instantiated with FileManager and Provider dependencies", () => {
      const fetcher = new BalanceFetcher(mockFileManager, mockProvider);
      expect(fetcher).toBeDefined();
      expect(fetcher).toBeInstanceOf(BalanceFetcher);
    });
  });
});

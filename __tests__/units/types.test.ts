import {
  BlockNumberData,
  DistributorsData,
  BalanceData,
  OutflowData,
  DistributorType,
  type DateString,
  type Address,
  DISTRIBUTOR_METHODS,
  FileManager,
  FileManagerError,
  ValidationError,
  CONTRACTS,
  CHAIN_IDS,
  STORE_DIR,
  DISTRIBUTORS_DIR,
  isValidDistributorType,
  isValidDateString,
  isValidDecimalString,
} from "../../src/types";

describe("Core Types", () => {
  describe("BlockNumberData", () => {
    it("should create valid BlockNumberData object", () => {
      const data: BlockNumberData = {
        metadata: {
          chain_id: 42161,
        },
        blocks: {
          "2024-01-15": 12345678,
        },
      };
      expect(data.metadata.chain_id).toBe(42161);
      expect(data.blocks["2024-01-15"]).toBe(12345678);
    });
  });

  describe("DistributorType enum", () => {
    it("should have all required distributor types", () => {
      expect(DistributorType.L2_BASE_FEE).toBe("L2_BASE_FEE");
      expect(DistributorType.L2_SURPLUS_FEE).toBe("L2_SURPLUS_FEE");
      expect(DistributorType.L1_SURPLUS_FEE).toBe("L1_SURPLUS_FEE");
      expect(DistributorType.L1_BASE_FEE).toBe("L1_BASE_FEE");
    });
  });

  describe("DistributorsData", () => {
    it("should create valid DistributorsData object", () => {
      const data: DistributorsData = {
        metadata: {
          chain_id: 42161,
          arbowner_address: "0x0000000000000000000000000000000000000070",
        },
        distributors: {
          "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9": {
            type: DistributorType.L2_BASE_FEE,
            discovered_block: 12345678,
            discovered_date: "2024-01-15",
            tx_hash: "0xabc123",
            method: "0xee95a824",
            owner: "0x0000000000000000000000000000000000000070",
            event_data:
              "0x00000000000000000000000067a24ce4321ab3af51c2d0a4801c3e111d88c9d9",
          },
        },
      };
      expect(data.metadata.chain_id).toBe(42161);
      expect(data.metadata.arbowner_address).toBe(
        "0x0000000000000000000000000000000000000070",
      );
      const distributor =
        data.distributors["0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9"];
      expect(distributor).toBeDefined();
      expect(distributor?.type).toBe(DistributorType.L2_BASE_FEE);
      expect(distributor?.discovered_block).toBe(12345678);
    });
  });

  describe("BalanceData", () => {
    it("should create valid BalanceData object", () => {
      const data: BalanceData = {
        metadata: {
          chain_id: 42161,
          reward_distributor: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
        },
        balances: {
          "2024-01-15": {
            block_number: 12345678,
            balance_wei: "1000000000000000000000",
          },
        },
      };
      expect(data.metadata.chain_id).toBe(42161);
      const balance = data.balances["2024-01-15"];
      expect(balance).toBeDefined();
      expect(balance?.balance_wei).toBe("1000000000000000000000");
    });
  });

  describe("OutflowData", () => {
    it("should create valid OutflowData object", () => {
      const data: OutflowData = {
        metadata: {
          chain_id: 42161,
          reward_distributor: "0x67a24CE4321aB3aF51c2D0a4801c3E111D88C9d9",
        },
        outflows: {
          "2024-01-15": {
            block_number: 12345678,
            total_outflow_wei: "500000000000000000000",
            events: [
              {
                recipient: "0x1234567890123456789012345678901234567890",
                value_wei: "500000000000000000000",
                tx_hash: "0xdef456",
              },
            ],
          },
        },
      };
      expect(data.metadata.chain_id).toBe(42161);
      const outflow = data.outflows["2024-01-15"];
      expect(outflow).toBeDefined();
      expect(outflow?.total_outflow_wei).toBe("500000000000000000000");
      expect(outflow?.events[0]?.recipient).toBe(
        "0x1234567890123456789012345678901234567890",
      );
    });
  });

  describe("Constants", () => {
    it("should define DISTRIBUTOR_METHODS correctly", () => {
      expect(DISTRIBUTOR_METHODS.L2_BASE_FEE).toBe("0xee95a824");
      expect(DISTRIBUTOR_METHODS.L2_SURPLUS_FEE).toBe("0x2d9125e9");
      expect(DISTRIBUTOR_METHODS.L1_SURPLUS_FEE).toBe("0x934be07d");
    });

    it("should define CONTRACTS correctly", () => {
      expect(CONTRACTS.ARB_OWNER).toBe(
        "0x0000000000000000000000000000000000000070",
      );
      expect(CONTRACTS.ARB_INFO).toBe(
        "0x000000000000000000000000000000000000006D",
      );
    });

    it("should define CHAIN_IDS correctly", () => {
      expect(CHAIN_IDS.ARBITRUM_ONE).toBe(42161);
      expect(CHAIN_IDS.ARBITRUM_NOVA).toBe(42170);
    });

    it("should define file paths correctly", () => {
      expect(STORE_DIR).toBe("store");
      expect(DISTRIBUTORS_DIR).toBe("distributors");
    });
  });

  describe("FileManagerError", () => {
    it("should create error with all properties", () => {
      const error = new FileManagerError(
        "Failed to read file",
        "read",
        "/path/to/file",
        new Error("ENOENT"),
      );
      expect(error.message).toBe("Failed to read file");
      expect(error.operation).toBe("read");
      expect(error.path).toBe("/path/to/file");
      expect(error.cause).toBeInstanceOf(Error);
      expect(error.name).toBe("FileManagerError");
    });

    it("should create error without optional properties", () => {
      const error = new FileManagerError("Operation failed", "write");
      expect(error.message).toBe("Operation failed");
      expect(error.operation).toBe("write");
      expect(error.path).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });
  });

  describe("ValidationError", () => {
    it("should create error with all properties", () => {
      const error = new ValidationError(
        "Invalid value",
        "balance",
        "-100",
        "non-negative number",
      );
      expect(error.message).toBe("Invalid value");
      expect(error.field).toBe("balance");
      expect(error.value).toBe("-100");
      expect(error.expected).toBe("non-negative number");
      expect(error.name).toBe("ValidationError");
    });
  });

  describe("Type Guards", () => {
    describe("isValidDistributorType", () => {
      it("should return true for valid distributor types", () => {
        expect(isValidDistributorType("L2_BASE_FEE")).toBe(true);
        expect(isValidDistributorType("L2_SURPLUS_FEE")).toBe(true);
        expect(isValidDistributorType("L1_SURPLUS_FEE")).toBe(true);
        expect(isValidDistributorType("L1_BASE_FEE")).toBe(true);
      });

      it("should return false for invalid distributor types", () => {
        expect(isValidDistributorType("INVALID_TYPE")).toBe(false);
        expect(isValidDistributorType("")).toBe(false);
        expect(isValidDistributorType("l2_base_fee")).toBe(false);
      });
    });

    describe("isValidDateString", () => {
      it("should return true for valid date strings", () => {
        expect(isValidDateString("2024-01-15")).toBe(true);
        expect(isValidDateString("2023-12-31")).toBe(true);
        expect(isValidDateString("2025-06-01")).toBe(true);
      });

      it("should return false for invalid date strings", () => {
        expect(isValidDateString("2024-1-15")).toBe(false);
        expect(isValidDateString("2024/01/15")).toBe(false);
        expect(isValidDateString("01-15-2024")).toBe(false);
        expect(isValidDateString("2024-01-15T00:00:00Z")).toBe(false);
        expect(isValidDateString("")).toBe(false);
      });
    });

    describe("isValidDecimalString", () => {
      it("should return true for valid decimal strings", () => {
        expect(isValidDecimalString("0")).toBe(true);
        expect(isValidDecimalString("1000000000000000000000")).toBe(true);
        expect(isValidDecimalString("123456789")).toBe(true);
      });

      it("should return false for invalid decimal strings", () => {
        expect(isValidDecimalString("1.23e+21")).toBe(false);
        expect(isValidDecimalString("-100")).toBe(false);
        expect(isValidDecimalString("12.34")).toBe(false);
        expect(isValidDecimalString("")).toBe(false);
        expect(isValidDecimalString("abc")).toBe(false);
      });
    });
  });

  describe("FileManager Interface", () => {
    it("should define FileManager interface correctly", () => {
      const mockFileManager: FileManager = {
        readBlockNumbers: async () => ({
          metadata: { chain_id: 42161 },
          blocks: {},
        }),
        writeBlockNumbers: async () => {},
        readDistributors: async () => ({
          metadata: { chain_id: 42161, arbowner_address: "" },
          distributors: {},
        }),
        writeDistributors: async () => {},
        readDistributorBalances: async () => ({
          metadata: { chain_id: 42161, reward_distributor: "" },
          balances: {},
        }),
        writeDistributorBalances: async () => {},
        readDistributorOutflows: async () => ({
          metadata: { chain_id: 42161, reward_distributor: "" },
          outflows: {},
        }),
        writeDistributorOutflows: async () => {},
        ensureStoreDirectory: async () => {},
        validateAddress: (address: string) => address as Address,
        formatDate: (date: Date) =>
          date.toISOString().split("T")[0] as DateString,
        validateDateFormat: () => {},
        validateBlockNumber: () => {},
        validateWeiValue: () => {},
        validateTransactionHash: () => {},
        validateEnumValue: () => {},
      };
      expect(mockFileManager).toBeDefined();
    });
  });
});

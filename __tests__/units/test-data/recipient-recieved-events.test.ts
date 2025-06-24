import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { ethers } from "ethers";

interface RecipientRecievedEvent {
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  address: string;
  topics: string[];
  data: string;
  recipient: string;
  value: string;
}

interface RecipientRecievedTestData {
  chain_id: number;
  distributor_address: string;
  events: RecipientRecievedEvent[];
  block_range?: {
    start: number;
    end: number;
  };
}

describe("RecipientRecieved Event Test Data", () => {
  const TEST_DATA_DIR = join(__dirname, "../../test-data/recipient-recieved");
  const DISTRIBUTOR_ADDRESSES = [
    "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
    "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce",
    "0x509386DbF5C0BE6fd68Df97A05fdB375136c32De",
    "0x9fCB6F75D99029f28F6F4a1d277bae49c5CAC79f",
    "0xdff90519a9DE6ad469D4f9839a9220C5D340B792",
  ];

  describe("Event data files exist", () => {
    it("should have test data directory", () => {
      expect(existsSync(TEST_DATA_DIR)).toBe(true);
    });

    it("should have event data for at least 3 distributors", () => {
      const existingFiles = DISTRIBUTOR_ADDRESSES.filter((address) => {
        const filePath = join(TEST_DATA_DIR, `${address}.json`);
        return existsSync(filePath);
      });

      expect(existingFiles.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Event data structure", () => {
    const loadedData: Map<string, RecipientRecievedTestData> = new Map();

    beforeAll(() => {
      DISTRIBUTOR_ADDRESSES.forEach((address) => {
        const filePath = join(TEST_DATA_DIR, `${address}.json`);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, "utf-8");
          loadedData.set(address, JSON.parse(content));
        }
      });
    });

    it("should have required metadata fields", () => {
      loadedData.forEach((data, address) => {
        expect(data).toHaveProperty("chain_id");
        expect(data).toHaveProperty("distributor_address");
        expect(data).toHaveProperty("events");

        expect(data.chain_id).toBe(42170); // Nova Arbitrum
        expect(data.distributor_address.toLowerCase()).toBe(
          address.toLowerCase(),
        );
        expect(Array.isArray(data.events)).toBe(true);
      });
    });

    it("should have properly structured events", () => {
      loadedData.forEach((data) => {
        expect(data.events.length).toBeGreaterThan(0);

        data.events.forEach((event) => {
          // Raw event fields
          expect(event).toHaveProperty("blockNumber");
          expect(event).toHaveProperty("transactionHash");
          expect(event).toHaveProperty("logIndex");
          expect(event).toHaveProperty("address");
          expect(event).toHaveProperty("topics");
          expect(event).toHaveProperty("data");

          // Parsed fields
          expect(event).toHaveProperty("recipient");
          expect(event).toHaveProperty("value");

          // Validate types
          expect(typeof event.blockNumber).toBe("number");
          expect(typeof event.transactionHash).toBe("string");
          expect(typeof event.logIndex).toBe("number");
          expect(typeof event.address).toBe("string");
          expect(Array.isArray(event.topics)).toBe(true);
          expect(typeof event.data).toBe("string");
          expect(typeof event.recipient).toBe("string");
          expect(typeof event.value).toBe("string");
        });
      });
    });
  });

  describe("Event data integrity", () => {
    const loadedData: Map<string, RecipientRecievedTestData> = new Map();
    const RECIPIENT_RECIEVED_SIGNATURE = ethers.id(
      "RecipientRecieved(address,uint256)",
    );

    beforeAll(() => {
      DISTRIBUTOR_ADDRESSES.forEach((address) => {
        const filePath = join(TEST_DATA_DIR, `${address}.json`);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, "utf-8");
          loadedData.set(address, JSON.parse(content));
        }
      });
    });

    it("should have correct event signature", () => {
      loadedData.forEach((data) => {
        data.events.forEach((event) => {
          expect(event.topics[0]).toBe(RECIPIENT_RECIEVED_SIGNATURE);
        });
      });
    });

    it("should have checksummed recipient addresses", () => {
      loadedData.forEach((data) => {
        data.events.forEach((event) => {
          expect(event.recipient).toBe(ethers.getAddress(event.recipient));
        });
      });
    });

    it("should have valid decimal string values", () => {
      loadedData.forEach((data) => {
        data.events.forEach((event) => {
          expect(/^\d+$/.test(event.value)).toBe(true);
          expect(BigInt(event.value)).toBeGreaterThan(0n);
        });
      });
    });

    it("should have valid transaction hashes", () => {
      loadedData.forEach((data) => {
        data.events.forEach((event) => {
          expect(event.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        });
      });
    });
  });

  describe("Event coverage", () => {
    const loadedData: Map<string, RecipientRecievedTestData> = new Map();

    beforeAll(() => {
      DISTRIBUTOR_ADDRESSES.forEach((address) => {
        const filePath = join(TEST_DATA_DIR, `${address}.json`);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, "utf-8");
          loadedData.set(address, JSON.parse(content));
        }
      });
    });

    it("should have events from multiple blocks", () => {
      loadedData.forEach((data) => {
        const blockNumbers = new Set(data.events.map((e) => e.blockNumber));
        expect(blockNumbers.size).toBeGreaterThan(1);
      });
    });

    it("should have both large and small value transfers", () => {
      const allValues: bigint[] = [];
      loadedData.forEach((data) => {
        data.events.forEach((event) => {
          allValues.push(BigInt(event.value));
        });
      });

      const sortedValues = allValues.sort((a, b) => (a < b ? -1 : 1));
      expect(sortedValues.length).toBeGreaterThan(1);

      const smallest = sortedValues[0]!;
      const largest = sortedValues[sortedValues.length - 1]!;

      // Should have at least 10x difference between smallest and largest
      expect(largest / smallest).toBeGreaterThan(10n);
    });

    it("should document block ranges in metadata", () => {
      loadedData.forEach((data) => {
        expect(data).toHaveProperty("block_range");
        expect(data.block_range).toBeDefined();
        expect(data.block_range!).toHaveProperty("start");
        expect(data.block_range!).toHaveProperty("end");
        expect(typeof data.block_range!.start).toBe("number");
        expect(typeof data.block_range!.end).toBe("number");
        expect(data.block_range!.end).toBeGreaterThanOrEqual(
          data.block_range!.start,
        );
      });
    });
  });

  describe("Documentation", () => {
    it("should have README explaining the data structure", () => {
      const readmePath = join(TEST_DATA_DIR, "README.md");
      expect(existsSync(readmePath)).toBe(true);
    });
  });
});

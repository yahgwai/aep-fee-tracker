import { BalanceFetcher } from "../../src/balance-fetcher";

describe("BalanceFetcher", () => {
  describe("parseDistributorAddresses", () => {
    it("extracts all 6 distributor addresses from raw events", () => {
      const rawEvents = require("../test-data/distributor-detector/distributor-creation-events-raw.json");

      const addresses = BalanceFetcher.parseDistributorAddresses(
        rawEvents.events,
      );

      expect(addresses).toHaveLength(6);
      expect(addresses).toEqual([
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        "0xdff90519a9DE6ad469D4f9839a9220C5D340B792",
        "0x9fCB6F75D99029f28F6F4a1d277bae49c5CAC79f",
        "0x509386DbF5C0BE6fd68Df97A05fdB375136c32De",
        "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce",
      ]);
    });

    it("correctly parses addresses from event data field", () => {
      const testEvent = {
        data: "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000024fcdde2b400000000000000000000000037daa99b1caae0c22670963e103a66ca2c5db2db00000000000000000000000000000000000000000000000000000000",
      };

      const addresses = BalanceFetcher.parseDistributorAddresses([testEvent]);

      expect(addresses).toHaveLength(1);
      expect(addresses[0]).toBe("0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB");
    });
  });

  describe("fetchBalance", () => {
    it("fetches ETH balance for a single address at a specific block", async () => {
      const mockProvider = {
        getBalance: jest.fn().mockResolvedValue(BigInt("1234567890000000000")),
      };

      const balance = await BalanceFetcher.fetchBalance(
        mockProvider as unknown as import("ethers").Provider,
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        155,
      );

      expect(balance).toBe("1234567890000000000");
      expect(mockProvider.getBalance).toHaveBeenCalledWith(
        "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
        155,
      );
    });
  });
});

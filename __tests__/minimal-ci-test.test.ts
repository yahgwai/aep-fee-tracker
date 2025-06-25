import { describe, it, expect } from "@jest/globals";
import { ethers } from "ethers";

describe("Minimal CI Test", () => {
  it("should connect to RPC", async () => {
    const rpcUrl = process.env["ARBITRUM_NOVA_RPC_URL"];
    console.log("RPC URL starts with:", rpcUrl?.substring(0, 20) + "...");

    expect(rpcUrl).toBeDefined();
    expect(rpcUrl).toContain("https://");

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const blockNumber = await provider.getBlockNumber();
    console.log("Current block number:", blockNumber);
    expect(blockNumber).toBeGreaterThan(0);
  });
});

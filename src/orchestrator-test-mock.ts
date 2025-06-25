/**
 * Test mock for the orchestrator module
 * This file is used only during testing to simulate orchestrator behavior
 * without making actual network calls or file system operations.
 *
 * WARNING: This file should NEVER be imported in production code
 * It is only imported by cli.ts when NODE_ENV=test
 */
import { Configuration } from "./types";

export async function orchestrate(config: Configuration): Promise<void> {
  // Mock orchestrator for testing CLI integration
  if (process.env["NODE_ENV"] !== "test") {
    throw new Error("This mock should only be used in tests");
  }

  // Simulate successful execution for valid test URL
  if (config.rpcUrl === "https://valid-archive-node.com/rpc") {
    // Validate dates if provided
    if (config.startDate) {
      const startDate = new Date(config.startDate);
      if (isNaN(startDate.getTime())) {
        throw new Error("Invalid start date format");
      }
    }

    if (config.endDate) {
      const endDate = new Date(config.endDate);
      if (isNaN(endDate.getTime())) {
        throw new Error("Invalid end date format");
      }
    }

    // Validate date range
    if (config.startDate && config.endDate) {
      const startDate = new Date(config.startDate);
      const endDate = new Date(config.endDate);
      if (startDate > endDate) {
        throw new Error("Start date must be before or equal to end date");
      }
    }

    // Simulate file system error for specific path
    if (config.storeDirectory === "/root/cannot-create-this/store") {
      throw new Error(
        "EACCES: permission denied, mkdir '/root/cannot-create-this/store'",
      );
    }

    // Success case
    return;
  }

  // Simulate various error conditions based on URL
  if (config.rpcUrl === "invalid-url") {
    throw new Error("Invalid URL");
  }

  if (config.rpcUrl.includes("not-a-real-rpc-endpoint")) {
    throw new Error(
      "ENOTFOUND: getaddrinfo ENOTFOUND definitely-not-a-real-rpc-endpoint.invalid",
    );
  }

  // Default error for unknown test URLs
  throw new Error("Failed to connect to RPC endpoint");
}

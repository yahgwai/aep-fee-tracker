import { ethers } from "ethers";
import { BlockFinder } from "../src/block-finder";
import { FileManager } from "../src/file-manager";
import { BlockNumberData } from "../src/types";
import * as fs from "fs";
import * as path from "path";

async function generateTestBlockData() {
  console.log(
    "Starting block data generation for distributor detector tests...",
  );

  // Initialize provider - using public Arbitrum Nova RPC
  const rpcUrl = "https://nova.arbitrum.io/rpc";
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Create a temporary file manager that will write to test data directory
  class TestFileManager extends FileManager {
    private testDataPath: string;

    constructor(testDataPath: string) {
      super();
      this.testDataPath = testDataPath;
    }

    override writeBlockNumbers(data: BlockNumberData): void {
      const filePath = path.join(this.testDataPath, "block_numbers.json");
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }

    override readBlockNumbers(): BlockNumberData | undefined {
      const filePath = path.join(this.testDataPath, "block_numbers.json");
      if (!fs.existsSync(filePath)) {
        return undefined;
      }
      return JSON.parse(fs.readFileSync(filePath, "utf-8")) as BlockNumberData;
    }
  }

  // Create file manager pointing to test data directory
  const testDataPath = path.join(
    __dirname,
    "../__tests__/test-data/distributor-detector",
  );
  const fileManager = new TestFileManager(testDataPath);

  // Create BlockFinder instance
  const blockFinder = new BlockFinder(fileManager, provider);

  // Define date ranges to cover test events
  const dateRanges = [
    // Cover blocks 152, 153 (July 12, 2022)
    { start: new Date("2022-07-11"), end: new Date("2022-07-13") },
    // Cover block 684 (August 8, 2022)
    { start: new Date("2022-08-07"), end: new Date("2022-08-09") },
    // Cover block 3163115 (March 16, 2023)
    { start: new Date("2023-03-15"), end: new Date("2023-03-17") },
  ];

  console.log("Date ranges to process:");
  for (const range of dateRanges) {
    console.log(
      `  ${range.start.toISOString().split("T")[0]} to ${range.end.toISOString().split("T")[0]}`,
    );
  }

  // Process each date range
  for (const range of dateRanges) {
    console.log(
      `\nProcessing range: ${range.start.toISOString().split("T")[0]} to ${range.end.toISOString().split("T")[0]}...`,
    );

    try {
      await blockFinder.findBlocksForDateRange(range.start, range.end);
      console.log(`✓ Successfully processed range`);
    } catch (error) {
      console.error(`✗ Error processing range:`, error);
      throw error;
    }
  }

  // Read and display the final data
  const finalData = fileManager.readBlockNumbers();
  console.log("\nGenerated block data:");
  console.log(JSON.stringify(finalData, null, 2));

  console.log("\n✓ Block data generation complete!");
  console.log(
    `  Output file: ${path.join(testDataPath, "block_numbers.json")}`,
  );
}

// Run the script
generateTestBlockData().catch((error) => {
  console.error("Failed to generate block data:", error);
  process.exit(1);
});

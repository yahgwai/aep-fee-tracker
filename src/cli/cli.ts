#!/usr/bin/env node

import { parseArguments } from "./parse-arguments";
import { createConfiguration } from "./configuration";
import { orchestrate } from "../infrastructure/orchestration/orchestrator";

async function main(): Promise<void> {
  try {
    // Parse command-line arguments
    const args = parseArguments(process.argv.slice(2));

    // Create configuration from parsed arguments
    const configuration = createConfiguration(args);

    // Execute the orchestrated pipeline
    await orchestrate(configuration);

    // Exit successfully
    process.exit(0);
  } catch (error) {
    // Exit with error status
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("Error:", error);
    }
    process.exit(1);
  }
}

// Execute main function
main();

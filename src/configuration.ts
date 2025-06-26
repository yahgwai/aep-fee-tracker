import { ParsedArguments } from "./parse-arguments";
import { Configuration } from "./types";
import { validateDateRange } from "./date-validation";
import { validateAndCreateStoreDirectory } from "./store-directory-manager";

export function createConfiguration(
  parsedArgs: ParsedArguments,
): Configuration {
  const startDate = parsedArgs["start-date"];
  const endDate = parsedArgs["end-date"];

  // Validate dates if provided
  validateDateRange(startDate, endDate);

  // Validate and create store directory
  const storeDirectory = validateAndCreateStoreDirectory(
    parsedArgs["store-dir"],
  );

  const config: Configuration = {
    storeDirectory,
    rpcUrl: parsedArgs["rpc-url"]!,
  };

  if (startDate) {
    config.startDate = startDate;
  }

  if (endDate) {
    config.endDate = endDate;
  }

  return config;
}

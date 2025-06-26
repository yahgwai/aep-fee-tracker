import { ParsedArguments } from "./parse-arguments";
import { Configuration } from "./types";
import { validateDateRange } from "./date-validation";

const DEFAULT_STORE_DIRECTORY = "./store";

export function createConfiguration(
  parsedArgs: ParsedArguments,
): Configuration {
  const startDate = parsedArgs["start-date"];
  const endDate = parsedArgs["end-date"];

  // Validate dates if provided
  validateDateRange(startDate, endDate);

  const config: Configuration = {
    storeDirectory: parsedArgs["store-dir"] || DEFAULT_STORE_DIRECTORY,
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

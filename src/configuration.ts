import { ParsedArguments } from "./parse-arguments";
import { Configuration } from "./types";

const DEFAULT_STORE_DIRECTORY = "./store";

export function createConfiguration(
  parsedArgs: ParsedArguments,
): Configuration {
  const config: Configuration = {
    storeDirectory: parsedArgs["store-dir"] || DEFAULT_STORE_DIRECTORY,
    rpcUrl: parsedArgs["rpc-url"]!,
  };

  if (parsedArgs["start-date"]) {
    config.startDate = parsedArgs["start-date"];
  }

  if (parsedArgs["end-date"]) {
    config.endDate = parsedArgs["end-date"];
  }

  return config;
}

import { ParsedArguments } from "./parse-arguments";

export function createConfiguration(parsedArgs: ParsedArguments) {
  return {
    storeDirectory: parsedArgs["store-dir"] || "./store",
    rpcUrl: parsedArgs["rpc-url"]!,
    startDate: parsedArgs["start-date"],
    endDate: parsedArgs["end-date"],
  };
}

import { ParsedArguments } from "./parse-arguments";

export function createConfiguration(parsedArgs: ParsedArguments) {
  return {
    storeDirectory: parsedArgs["store-dir"] || "./store",
  };
}

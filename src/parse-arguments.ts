import minimist from "minimist";
import { validateRpcUrl } from "./url-validation";

export interface ParsedArguments {
  "rpc-url"?: string;
  "start-date"?: string;
  "end-date"?: string;
  "store-dir"?: string;
  _: string[];
  [key: string]: unknown;
}

const USAGE_MESSAGE =
  "Usage: aep --rpc-url <url> [--start-date <date>] [--end-date <date>] [--store-dir <path>]";

export function parseArguments(args: string[]): ParsedArguments {
  const parsed = minimist(args) as ParsedArguments;

  if (!parsed["rpc-url"]) {
    throw new Error(`--rpc-url is required\n\n${USAGE_MESSAGE}`);
  }

  // Validate the RPC URL format
  validateRpcUrl(parsed["rpc-url"]);

  return parsed;
}

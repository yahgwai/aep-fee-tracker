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

const VALID_ARGUMENTS = ["rpc-url", "start-date", "end-date", "store-dir"];

const ARGUMENT_DESCRIPTIONS = `Valid arguments:
  --rpc-url <url>      RPC endpoint URL (required)
  --start-date <date>  Start date in YYYY-MM-DD format
  --end-date <date>    End date in YYYY-MM-DD format
  --store-dir <path>   Directory for storing data`;

export function parseArguments(args: string[]): ParsedArguments {
  const parsed = minimist(args) as ParsedArguments;

  // Check for unknown arguments
  const unknownArgs: string[] = [];
  for (const key of Object.keys(parsed)) {
    if (key !== "_" && !VALID_ARGUMENTS.includes(key)) {
      unknownArgs.push(`--${key}`);
    }
  }

  if (unknownArgs.length > 0) {
    const errorMessage =
      unknownArgs.length === 1
        ? `Unknown argument: ${unknownArgs[0]}`
        : `Unknown arguments: ${unknownArgs.join(", ")}`;
    throw new Error(`${errorMessage}\n\n${ARGUMENT_DESCRIPTIONS}`);
  }

  if (!parsed["rpc-url"]) {
    throw new Error(`--rpc-url is required\n\n${USAGE_MESSAGE}`);
  }

  // Validate the RPC URL format
  validateRpcUrl(parsed["rpc-url"]);

  return parsed;
}

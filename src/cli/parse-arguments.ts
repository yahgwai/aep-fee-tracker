import minimist from "minimist";
import { validateRpcUrl } from "../utils/validation/url-validation";

export interface ParsedArguments {
  "rpc-url"?: string;
  "start-date"?: string;
  "end-date"?: string;
  "store-dir"?: string;
  "gcs-bucket"?: string;
  chain?: string;
  _: string[];
  [key: string]: unknown;
}

const USAGE_MESSAGE =
  "Usage: aep --rpc-url <url> [--start-date <date>] [--end-date <date>] [--store-dir <path>] [--gcs-bucket <bucket>] [--chain <chain>]";

const VALID_ARGUMENTS = [
  "rpc-url",
  "start-date",
  "end-date",
  "store-dir",
  "gcs-bucket",
  "chain",
];

const ARGUMENT_DESCRIPTIONS = `Valid arguments:
  --rpc-url <url>      RPC endpoint URL (required)
  --start-date <date>  Start date in YYYY-MM-DD format
  --end-date <date>    End date in YYYY-MM-DD format
  --store-dir <path>   Directory for storing data
  --gcs-bucket <bucket>   GCS bucket name for persistent storage
  --chain <chain>         Chain identifier for GCS path partitioning`;

function validateUnknownArguments(parsed: ParsedArguments): void {
  const unknownArgs = Object.keys(parsed)
    .filter((key) => key !== "_" && !VALID_ARGUMENTS.includes(key))
    .map((key) => `--${key}`);

  if (unknownArgs.length > 0) {
    const errorMessage =
      unknownArgs.length === 1
        ? `Unknown argument: ${unknownArgs[0]}`
        : `Unknown arguments: ${unknownArgs.join(", ")}`;
    throw new Error(`${errorMessage}\n\n${ARGUMENT_DESCRIPTIONS}`);
  }
}

function validateRequiredArguments(parsed: ParsedArguments): void {
  if (!parsed["rpc-url"]) {
    throw new Error(`--rpc-url is required\n\n${USAGE_MESSAGE}`);
  }
}

function validateGcsArguments(parsed: ParsedArguments): void {
  const hasGcsBucket = !!parsed["gcs-bucket"];
  const hasChain = !!parsed["chain"];

  // If GCS bucket is provided, chain must also be provided
  if (hasGcsBucket && !hasChain) {
    throw new Error(
      `--chain is required when using --gcs-bucket\n\n${USAGE_MESSAGE}`,
    );
  }
}

export function parseArguments(args: string[]): ParsedArguments {
  const parsed = minimist(args) as ParsedArguments;

  validateUnknownArguments(parsed);
  validateRequiredArguments(parsed);
  validateRpcUrl(parsed["rpc-url"]!);
  validateGcsArguments(parsed);

  return parsed;
}

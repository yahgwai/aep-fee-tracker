import minimist from "minimist";

export interface ParsedArguments {
  "rpc-url"?: string;
  "start-date"?: string;
  "end-date"?: string;
  "store-dir"?: string;
  _: string[];
  [key: string]: unknown;
}

export function parseArguments(args: string[]): ParsedArguments {
  const parsed = minimist(args) as ParsedArguments;

  if (!parsed["rpc-url"]) {
    throw new Error("--rpc-url is required");
  }

  return parsed;
}

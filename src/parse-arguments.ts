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
  return minimist(args) as ParsedArguments;
}

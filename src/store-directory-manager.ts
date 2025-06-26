const DEFAULT_STORE_DIR = "./store";

export function validateAndCreateStoreDirectory(storeDirArg?: string): string {
  if (storeDirArg === undefined) {
    return DEFAULT_STORE_DIR;
  }

  // Check if storeDirArg is null or not a string
  if (storeDirArg === null || typeof storeDirArg !== "string") {
    throw new Error("Store directory path must be a string");
  }

  // Check for empty string
  if (storeDirArg === "") {
    throw new Error("Store directory path cannot be empty");
  }

  // Check for invalid characters (null character)
  if (storeDirArg.includes("\0")) {
    throw new Error("Store directory path contains invalid characters");
  }

  return storeDirArg;
}

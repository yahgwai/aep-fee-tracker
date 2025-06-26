const DEFAULT_STORE_DIR = "./store";

export function validateAndCreateStoreDirectory(storeDirArg?: string): string {
  if (storeDirArg === undefined) {
    return DEFAULT_STORE_DIR;
  }

  if (storeDirArg === null || typeof storeDirArg !== "string") {
    throw new Error("Store directory path must be a string");
  }

  if (storeDirArg === "") {
    throw new Error("Store directory path cannot be empty");
  }

  if (storeDirArg.includes("\0")) {
    throw new Error("Store directory path contains invalid characters");
  }

  return storeDirArg;
}

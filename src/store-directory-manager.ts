const DEFAULT_STORE_DIR = "./store";

export function validateAndCreateStoreDirectory(storeDirArg?: string): string {
  if (storeDirArg === undefined) {
    return DEFAULT_STORE_DIR;
  }
  return storeDirArg;
}

export interface Logger {
  log: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

const isTestEnvironment = process.env["NODE_ENV"] === "test";

export const logger: Logger = {
  log: (message: string) => {
    if (!isTestEnvironment) {
      console.log(message);
    }
  },
  warn: (message: string) => {
    if (!isTestEnvironment) {
      console.warn(message);
    }
  },
  error: (message: string) => {
    // Always show errors, even in tests - they indicate real problems
    console.error(message);
  },
};

export default logger;

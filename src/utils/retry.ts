const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (i < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAY * Math.pow(2, i));
      }
    }
  }

  throw lastError!;
}

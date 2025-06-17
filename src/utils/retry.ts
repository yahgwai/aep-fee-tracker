const MAX_RETRIES = 3;

export async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError!;
}

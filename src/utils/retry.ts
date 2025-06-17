interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: Error) => boolean;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY = 1000; // 1 second
const DEFAULT_BACKOFF_MULTIPLIER = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const initialDelay = options.initialDelay ?? DEFAULT_INITIAL_DELAY;
  const backoffMultiplier =
    options.backoffMultiplier ?? DEFAULT_BACKOFF_MULTIPLIER;
  const shouldRetry = options.shouldRetry;

  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry this error
      if (shouldRetry && !shouldRetry(lastError)) {
        throw lastError;
      }

      if (i < maxRetries - 1) {
        await sleep(initialDelay * Math.pow(backoffMultiplier, i));
      }
    }
  }

  throw lastError!;
}

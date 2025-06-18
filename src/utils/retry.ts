export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: Error) => boolean;
  operationName?: string;
  rateLimitDelay?: number;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY = 1000; // 1 second
const DEFAULT_BACKOFF_MULTIPLIER = 2;
const DEFAULT_RATE_LIMIT_DELAY = 30000; // 30 seconds

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logRetryAttempt(
  retryNumber: number,
  maxRetries: number,
  operationName: string | undefined,
  error: Error,
): void {
  const baseMessage = `Retry attempt ${retryNumber}/${maxRetries}`;

  if (operationName) {
    console.log(
      `${baseMessage} for ${operationName} after error: ${error.message}`,
    );
  } else {
    console.log(baseMessage);
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    initialDelay = DEFAULT_INITIAL_DELAY,
    backoffMultiplier = DEFAULT_BACKOFF_MULTIPLIER,
    shouldRetry,
    operationName,
    rateLimitDelay = DEFAULT_RATE_LIMIT_DELAY,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry this error
      if (shouldRetry && !shouldRetry(lastError)) {
        throw lastError;
      }

      // Don't sleep after the last attempt
      if (attempt < maxRetries - 1) {
        // Check if this is a rate limit error
        const isRateLimit = lastError.message.includes("429");

        if (isRateLimit && operationName) {
          console.log(
            `Rate limit detected for ${operationName}, using longer delay`,
          );
        }

        const delay = isRateLimit
          ? rateLimitDelay
          : initialDelay * Math.pow(backoffMultiplier, attempt);

        logRetryAttempt(attempt + 1, maxRetries, operationName, lastError);
        await sleep(delay);
      }
    }
  }

  throw lastError!;
}

export async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  return await operation();
}

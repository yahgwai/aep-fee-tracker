export function validateRpcUrl(url: string): void {
  // Check if URL is provided
  if (url === undefined || url === null) {
    throw new Error("Invalid RPC URL: URL is required");
  }

  // Check if URL is a string
  if (typeof url !== "string") {
    throw new Error("Invalid RPC URL: URL must be a string");
  }

  // Check if URL starts with http:// or https://
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error("Invalid RPC URL: URL must start with http:// or https://");
  }

  // Try to parse the URL
  try {
    new URL(url);
  } catch {
    throw new Error("Invalid RPC URL: Invalid URL");
  }
}

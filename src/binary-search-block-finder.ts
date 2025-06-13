import { ethers } from "ethers";

const MILLISECONDS_PER_SECOND = 1000;

// Provider needs to be available for the function to work
// We'll use a module-level variable that can be set
let provider: ethers.Provider | null = null;

export function setProvider(p: ethers.Provider): void {
  provider = p;
}

export async function findEndOfDayBlock(
  targetMidnight: Date,
  lowerBound: number,
  upperBound: number,
): Promise<number> {
  if (!provider) {
    throw new Error("Provider not set. Call setProvider() first.");
  }

  const targetTimestamp = Math.floor(
    targetMidnight.getTime() / MILLISECONDS_PER_SECOND,
  );
  let low = lowerBound;
  let high = upperBound;
  let lastValidBlock = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const block = await provider.getBlock(mid);

    if (!block) {
      throw new Error(`Block ${mid} not found during binary search`);
    }

    if (block.timestamp < targetTimestamp) {
      lastValidBlock = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // If no valid block was found, all blocks are after midnight
  if (lastValidBlock === -1) {
    return lowerBound - 1;
  }

  return lastValidBlock;
}

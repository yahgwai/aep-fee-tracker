/**
 * Utility functions for date handling
 */

import { ethers } from "ethers";

/**
 * Gets yesterday's date as a Date object (end of previous day in UTC)
 * @returns Date object set to the start of yesterday (00:00:00 UTC)
 */
export function getYesterday(): Date {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);
  return yesterday;
}

/**
 * Gets the date associated with block 1 of the blockchain
 * @param provider - Ethereum provider to query block information
 * @returns Date object set to the start of the day when block 1 was mined
 */
export async function getBlock1Date(provider: ethers.Provider): Promise<Date> {
  const block1 = await provider.getBlock(1);
  if (!block1) {
    throw new Error("Block 1 not found");
  }
  
  const block1Date = new Date(block1.timestamp * 1000);
  // Set to start of day (00:00:00 UTC)
  block1Date.setUTCHours(0, 0, 0, 0);
  return block1Date;
}

/**
 * Formats a Date object to YYYY-MM-DD string format
 * @param date - Date object to format
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateToString(date: Date): string {
  const isoString = date.toISOString();
  const datePart = isoString.split("T")[0];
  if (!datePart) {
    throw new Error("Failed to format date to string");
  }
  return datePart;
}
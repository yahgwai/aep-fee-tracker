/**
 * Utility functions for date handling
 */

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
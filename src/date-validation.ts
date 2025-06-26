const DATE_FORMAT_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function validateDateFormat(date: string): boolean {
  return DATE_FORMAT_REGEX.test(date);
}

export function isValidCalendarDate(date: string): boolean {
  // First check format
  if (!validateDateFormat(date)) {
    return false;
  }

  // Parse and check roundtrip
  const parsed = new Date(date + "T00:00:00Z");
  const roundtrip = parsed.toISOString().split("T")[0];
  return roundtrip === date;
}

function validateDate(date: string, fieldName: string): void {
  if (!validateDateFormat(date)) {
    throw new Error(
      `Invalid ${fieldName} date format: ${date}. Expected YYYY-MM-DD`,
    );
  }
  if (!isValidCalendarDate(date)) {
    throw new Error(`Invalid ${fieldName} calendar date: ${date}`);
  }
}

export function validateDateRange(
  startDate: string | undefined,
  endDate: string | undefined,
): void {
  // If no dates provided, nothing to validate
  if (!startDate && !endDate) {
    return;
  }

  // Validate dates if provided
  if (startDate) {
    validateDate(startDate, "start");
  }

  if (endDate) {
    validateDate(endDate, "end");
  }

  // If both dates provided, ensure start <= end
  if (startDate && endDate && startDate > endDate) {
    throw new Error(
      `Start date (${startDate}) must be before or equal to end date (${endDate})`,
    );
  }
}

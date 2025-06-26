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

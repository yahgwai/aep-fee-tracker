const DATE_FORMAT_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function validateDateFormat(date: string): boolean {
  return DATE_FORMAT_REGEX.test(date);
}

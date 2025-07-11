export function getYesterday(now: Date = new Date()): Date {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(23, 59, 59, 999);
  return yesterday;
}

export function getDefaultStartDate(endDate: Date, daysBack: number = 30): Date {
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - daysBack);
  startDate.setHours(0, 0, 0, 0);
  return startDate;
}
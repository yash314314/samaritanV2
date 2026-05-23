export function getISTDayRange(date?: Date) {
  const base = date ? new Date(date) : new Date();

  const IST_OFFSET = 5.5 * 60 * 60 * 1000;

  const ist = new Date(base.getTime() + IST_OFFSET);

  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth();
  const day = ist.getUTCDate();

  const start = new Date(
    Date.UTC(year, month, day, 0, 0, 0, 0) - IST_OFFSET
  );

  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { start, end };
}
export type CalendarLayoutItem<T> = {
  event: T;
  column: number;
  columnCount: number;
};

export function layoutCalendarEvents<T extends { startAt: string; endAt: string }>(events: T[]) {
  const sorted = [...events].sort((left, right) => {
    const startDelta = new Date(left.startAt).getTime() - new Date(right.startAt).getTime();
    if (startDelta !== 0) return startDelta;
    return new Date(right.endAt).getTime() - new Date(left.endAt).getTime();
  });
  const result: CalendarLayoutItem<T>[] = [];
  let cluster: T[] = [];
  let clusterEnd = Number.NEGATIVE_INFINITY;

  function flushCluster() {
    if (!cluster.length) return;
    const columnEnds: number[] = [];
    const positioned = cluster.map((event) => {
      const start = new Date(event.startAt).getTime();
      const end = Math.max(start + 1, new Date(event.endAt).getTime());
      let column = columnEnds.findIndex((columnEnd) => columnEnd <= start);
      if (column === -1) column = columnEnds.length;
      columnEnds[column] = end;
      return { event, column };
    });
    const columnCount = Math.max(1, columnEnds.length);
    result.push(...positioned.map((item) => ({ ...item, columnCount })));
    cluster = [];
    clusterEnd = Number.NEGATIVE_INFINITY;
  }

  for (const event of sorted) {
    const start = new Date(event.startAt).getTime();
    const end = Math.max(start + 1, new Date(event.endAt).getTime());
    if (cluster.length && start >= clusterEnd) flushCluster();
    cluster.push(event);
    clusterEnd = Math.max(clusterEnd, end);
  }
  flushCluster();

  return result;
}

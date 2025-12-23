export const splitRangeByDays = (
  startIso: string,
  endIso: string,
  segmentDays: number
): Array<{ start: string; end: string }> => {
  const start = new Date(`${startIso}T00:00:00.000Z`);
  const end = new Date(`${endIso}T00:00:00.000Z`);
  const ranges: Array<{ start: string; end: string }> = [];

  let cursor = new Date(start);
  while (cursor <= end) {
    const segmentStart = new Date(cursor);
    const segmentEnd = new Date(cursor);
    segmentEnd.setUTCDate(segmentEnd.getUTCDate() + segmentDays - 1);
    if (segmentEnd > end) {
      segmentEnd.setTime(end.getTime());
    }

    ranges.push({
      start: segmentStart.toISOString().slice(0, 10),
      end: segmentEnd.toISOString().slice(0, 10),
    });

    cursor = new Date(segmentEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return ranges;
};

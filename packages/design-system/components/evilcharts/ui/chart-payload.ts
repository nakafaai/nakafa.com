/** Narrows unknown Recharts payload values to objects with string keys. */
export function isChartPayloadRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Reads a string field from an unknown Recharts payload value. */
export function getChartPayloadStringValue(payload: unknown, key?: string) {
  if (!(key && isChartPayloadRecord(payload))) {
    return;
  }

  const value = payload[key];
  return typeof value === "string" ? value : undefined;
}

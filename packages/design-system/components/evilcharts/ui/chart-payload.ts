import { Predicate } from "effect";

/** Reads a string field from an unknown Recharts payload value. */
export function getChartPayloadStringValue(payload: unknown, key?: string) {
  if (!(key && Predicate.isReadonlyObject(payload))) {
    return;
  }

  const value = payload[key];
  return typeof value === "string" ? value : undefined;
}

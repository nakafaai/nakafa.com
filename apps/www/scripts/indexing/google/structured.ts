import { Array as Arr, Predicate } from "effect";

/**
 * Checks whether one JSON-LD document is allowed by Google Indexing API.
 *
 * Google currently limits this API to pages with `JobPosting` structured data
 * or a livestream `BroadcastEvent` inside `VideoObject`; all other Nakafa URLs
 * stay discoverable through sitemap, robots, canonical metadata, and Search
 * Console instead of being submitted here.
 */
export function hasGoogleIndexingApiEligibleStructuredData(
  value: unknown
): boolean {
  return (
    hasSchemaType(value, "JobPosting") ||
    hasBroadcastEventInsideVideoObject(value)
  );
}

/** Recursively checks for one Schema.org `@type` value. */
function hasSchemaType(value: unknown, schemaType: string): boolean {
  if (Arr.isArray(value)) {
    return Arr.some(value, (entry) => hasSchemaType(entry, schemaType));
  }

  if (!Predicate.isReadonlyObject(value)) {
    return false;
  }

  if (Arr.contains(readSchemaTypes(value), schemaType)) {
    return true;
  }

  return Arr.some(readRecordValues(value), (entry) =>
    hasSchemaType(entry, schemaType)
  );
}

/** Checks Google's livestream case: BroadcastEvent nested in VideoObject. */
function hasBroadcastEventInsideVideoObject(value: unknown): boolean {
  if (Arr.isArray(value)) {
    return Arr.some(value, hasBroadcastEventInsideVideoObject);
  }

  if (!Predicate.isReadonlyObject(value)) {
    return false;
  }

  if (
    Arr.contains(readSchemaTypes(value), "VideoObject") &&
    hasSchemaType(value, "BroadcastEvent")
  ) {
    return true;
  }

  return Arr.some(readRecordValues(value), hasBroadcastEventInsideVideoObject);
}

/** Reads Schema.org `@type` values without assuming scalar or array shape. */
function readSchemaTypes(value: Readonly<Record<PropertyKey, unknown>>) {
  const schemaType = value["@type"];

  if (typeof schemaType === "string") {
    return [schemaType];
  }

  if (!Arr.isArray(schemaType)) {
    return [];
  }

  return Arr.filter(
    schemaType,
    (entry): entry is string => typeof entry === "string"
  );
}

/** Reads object values through the narrowed JSON record contract. */
function readRecordValues(value: Readonly<Record<PropertyKey, unknown>>) {
  return Arr.map(Reflect.ownKeys(value), (key) => value[key]);
}

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
  if (Array.isArray(value)) {
    return value.some((entry) => hasSchemaType(entry, schemaType));
  }

  if (!isRecord(value)) {
    return false;
  }

  if (readSchemaTypes(value).includes(schemaType)) {
    return true;
  }

  return readRecordValues(value).some((entry) =>
    hasSchemaType(entry, schemaType)
  );
}

/** Checks Google's livestream case: BroadcastEvent nested in VideoObject. */
function hasBroadcastEventInsideVideoObject(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasBroadcastEventInsideVideoObject);
  }

  if (!isRecord(value)) {
    return false;
  }

  if (
    readSchemaTypes(value).includes("VideoObject") &&
    hasSchemaType(value, "BroadcastEvent")
  ) {
    return true;
  }

  return readRecordValues(value).some(hasBroadcastEventInsideVideoObject);
}

/** Narrows unknown JSON data to a key-readable object. */
function isRecord(
  value: unknown
): value is Readonly<Record<PropertyKey, unknown>> {
  return typeof value === "object" && value !== null;
}

/** Reads Schema.org `@type` values without assuming scalar or array shape. */
function readSchemaTypes(value: Readonly<Record<PropertyKey, unknown>>) {
  const schemaType = value["@type"];

  if (typeof schemaType === "string") {
    return [schemaType];
  }

  if (!Array.isArray(schemaType)) {
    return [];
  }

  return schemaType.filter(
    (entry): entry is string => typeof entry === "string"
  );
}

/** Reads object values through the narrowed JSON record contract. */
function readRecordValues(value: Readonly<Record<PropertyKey, unknown>>) {
  const values: unknown[] = [];

  for (const key of Reflect.ownKeys(value)) {
    values.push(value[key]);
  }

  return values;
}

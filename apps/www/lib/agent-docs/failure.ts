import type { CheckResult } from "afdocs";

const MAX_DETAIL_ITEMS = 5;
const MAX_STRING_LENGTH = 160;
const DETAIL_ARRAY_FIELDS = [
  "broken",
  "pageResults",
  "endpointResults",
  "analyses",
  "tabbedPages",
] as const;
const DETAIL_VALUE_FIELDS = [
  "url",
  "testUrl",
  "mdUrl",
  "status",
  "classification",
  "missingPercent",
  "convertedCharacters",
  "characters",
  "htmlCharacters",
  "contentStartPercent",
  "positionPercent",
  "error",
] as const;

/** Formats bounded AFDocs evidence without copying response bodies into CI logs. */
export function formatAgentDocsFailure(result: CheckResult) {
  const summary = `[${result.status}] ${result.message}`;
  const detailLines = readDetailLines(result.details);

  if (detailLines.length === 0) {
    return summary;
  }

  return `${summary}\n${detailLines.join("\n")}`;
}

function readDetailLines(details: CheckResult["details"]) {
  if (!details) {
    return [];
  }

  const detailItems: unknown[] = [];

  for (const field of DETAIL_ARRAY_FIELDS) {
    const items = details[field];
    if (!Array.isArray(items)) {
      continue;
    }

    detailItems.push(...items);
  }

  return detailItems
    .sort((left, right) => Number(isOffender(right)) - Number(isOffender(left)))
    .map(formatDetailItem)
    .filter((line): line is string => line !== null)
    .slice(0, MAX_DETAIL_ITEMS)
    .map((line) => `detail: ${line}`);
}

function isOffender(item: unknown) {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    return false;
  }

  const valuesByField = new Map(Object.entries(item));
  const error = valuesByField.get("error");
  const status = valuesByField.get("status");
  const missingPercent = valuesByField.get("missingPercent");

  if (typeof error === "string" && error.length > 0) {
    return true;
  }

  if (typeof status === "string") {
    return status !== "pass";
  }

  if (typeof status === "number") {
    return status < 200 || status >= 300;
  }

  return typeof missingPercent === "number" && missingPercent > 0;
}

function formatDetailItem(item: unknown) {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    return null;
  }

  const valuesByField = new Map(Object.entries(item));
  const values: string[] = [];

  for (const field of DETAIL_VALUE_FIELDS) {
    const value = formatDetailValue(valuesByField.get(field));
    if (value !== null) {
      values.push(`${field}=${value}`);
    }
  }

  return values.length > 0 ? values.join(" ") : null;
}

function formatDetailValue(value: unknown) {
  if (typeof value === "string") {
    return JSON.stringify(value.slice(0, MAX_STRING_LENGTH));
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

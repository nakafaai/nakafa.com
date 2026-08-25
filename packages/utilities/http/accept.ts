export interface MediaPreference {
  readonly mediaType: string;
  readonly quality: number;
  readonly specificity: number;
}

interface MediaRange {
  readonly parameters: Readonly<Record<string, string>>;
  readonly quality: number;
  readonly subtype: string;
  readonly type: string;
}

const QUALITY_PATTERN = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;
const TOKEN_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/** Selects the highest-ranked supported representation from an Accept header. */
export function negotiateMediaType(
  acceptHeader: string | null,
  supportedMediaTypes: readonly string[]
) {
  const ranges = parseAcceptHeader(acceptHeader);
  let best: MediaPreference | null = null;
  for (const mediaType of supportedMediaTypes) {
    const preference = readMediaPreference(ranges, mediaType);
    if (preference.quality === 0) {
      continue;
    }
    if (!best || outranks(preference, best)) {
      best = preference;
    }
  }
  return best?.mediaType ?? null;
}

/** Merges Vary field names case-insensitively without losing existing values. */
export function mergeVaryHeader(
  current: string | null,
  required: readonly string[]
) {
  const values =
    current
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
  const names = new Set(values.map((value) => value.toLowerCase()));
  if (names.has("*")) {
    return "*";
  }
  for (const value of required) {
    if (!names.has(value.toLowerCase())) {
      values.push(value);
      names.add(value.toLowerCase());
    }
  }
  return values.join(", ");
}

/** Parses valid media ranges and treats malformed q values as unacceptable. */
function parseAcceptHeader(acceptHeader: string | null): MediaRange[] {
  if (acceptHeader === null) {
    return [{ parameters: {}, quality: 1, subtype: "*", type: "*" }];
  }
  const sources = splitOutsideQuotes(acceptHeader, ",");
  if (!sources) {
    return [];
  }
  const ranges: MediaRange[] = [];
  for (const source of sources) {
    const parsed = parseMediaType(source, true);
    if (!parsed) {
      continue;
    }
    ranges.push({
      parameters: parsed.parameters,
      quality: parsed.quality,
      subtype: parsed.subtype,
      type: parsed.type,
    });
  }
  return ranges;
}

/** Resolves the most specific range controlling one offered representation. */
function readMediaPreference(
  ranges: readonly MediaRange[],
  mediaType: string
): MediaPreference {
  const offered = parseMediaType(mediaType, false);
  if (!offered || offered.type === "*" || offered.subtype === "*") {
    return { mediaType, quality: 0, specificity: -1 };
  }
  let selected: MediaRange | null = null;
  let specificity = -1;
  for (const range of ranges) {
    const rangeSpecificity = getSpecificity(range, offered);
    if (rangeSpecificity < 0) {
      continue;
    }
    if (
      !selected ||
      rangeSpecificity > specificity ||
      (rangeSpecificity === specificity && range.quality > selected.quality)
    ) {
      selected = range;
      specificity = rangeSpecificity;
    }
  }
  return {
    mediaType,
    quality: selected?.quality ?? 0,
    specificity,
  };
}

/** Scores exact, subtype wildcard, and global wildcard matches. */
function getSpecificity(
  range: MediaRange,
  offered: Pick<MediaRange, "parameters" | "subtype" | "type">
) {
  if (range.type !== "*" && range.type !== offered.type) {
    return -1;
  }
  if (range.subtype !== "*" && range.subtype !== offered.subtype) {
    return -1;
  }
  for (const [name, value] of Object.entries(range.parameters)) {
    if (offered.parameters[name] !== value) {
      return -1;
    }
  }
  const typeSpecificity = range.type === "*" ? 0 : 2;
  const subtypeSpecificity = range.subtype === "*" ? 0 : 1;
  const parameterCount = Object.keys(range.parameters).length;
  const parameterSpecificity = parameterCount / (parameterCount + 1);
  return typeSpecificity + subtypeSpecificity + parameterSpecificity;
}

/** Compares client quality while preserving server order for equal quality. */
function outranks(candidate: MediaPreference, current: MediaPreference) {
  return candidate.quality > current.quality;
}

/** Parses one media type or range with validated RFC token parameters. */
function parseMediaType(source: string, allowsWeight: boolean) {
  const parts = splitOutsideQuotes(source, ";");
  if (!parts) {
    return null;
  }
  const [rawType, ...rawParameters] = parts;
  const [type, subtype, extra] = rawType.trim().toLowerCase().split("/");
  if (
    extra !== undefined ||
    !type ||
    !subtype ||
    !TOKEN_PATTERN.test(type) ||
    !TOKEN_PATTERN.test(subtype) ||
    (type === "*" && subtype !== "*")
  ) {
    return null;
  }

  let quality = 1;
  let hasWeight = false;
  const parameters: Record<string, string> = {};
  for (const rawParameter of rawParameters) {
    const separatorIndex = rawParameter.indexOf("=");
    if (separatorIndex <= 0) {
      return null;
    }
    const name = rawParameter.slice(0, separatorIndex).trim().toLowerCase();
    const rawValue = rawParameter.slice(separatorIndex + 1).trim();
    if (!TOKEN_PATTERN.test(name)) {
      return null;
    }
    if (name === "q") {
      if (!allowsWeight || hasWeight || !QUALITY_PATTERN.test(rawValue)) {
        return null;
      }
      quality = Number(rawValue);
      hasWeight = true;
      continue;
    }
    const value = parseParameterValue(rawValue);
    if (value === null || name in parameters) {
      return null;
    }
    // RFC 9110 section 8.3.1 defines charset values as case-insensitive.
    parameters[name] = name === "charset" ? value.toLowerCase() : value;
  }
  return { parameters, quality, subtype, type };
}

/** Parses one token or quoted-string parameter value for exact matching. */
function parseParameterValue(source: string) {
  if (TOKEN_PATTERN.test(source)) {
    return source;
  }
  if (!(source.startsWith('"') && source.endsWith('"'))) {
    return null;
  }
  let value = "";
  for (let index = 1; index < source.length - 1; index += 1) {
    const character = source[index];
    if (character === "\\") {
      index += 1;
      value += source.charAt(index);
      continue;
    }
    if (character === '"' || character === "\r" || character === "\n") {
      return null;
    }
    value += character;
  }
  return value;
}

/** Splits one HTTP list while preserving delimiters inside quoted strings. */
function splitOutsideQuotes(
  source: string,
  delimiter: "," | ";"
): [string, ...string[]] | null {
  let first: string | null = null;
  const rest: string[] = [];
  let current = "";
  let escaped = false;
  let quoted = false;
  for (const character of source) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (quoted && character === "\\") {
      current += character;
      escaped = true;
      continue;
    }
    if (character === '"') {
      current += character;
      quoted = !quoted;
      continue;
    }
    if (character === delimiter && !quoted) {
      if (first === null) {
        first = current;
      } else {
        rest.push(current);
      }
      current = "";
      continue;
    }
    current += character;
  }
  if (quoted) {
    return null;
  }
  return first === null ? [current] : [first, ...rest, current];
}

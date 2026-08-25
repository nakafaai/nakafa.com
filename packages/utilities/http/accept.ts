import { Option, Schema } from "effect";

interface ParsedMediaType {
  readonly parameters: ReadonlyMap<string, string>;
  readonly quality: number;
  readonly subtype: string;
  readonly type: string;
}

interface MediaRangeSpecificity {
  readonly parameterCount: number;
  readonly rank: number;
}

interface RangePreference {
  readonly quality: number;
  readonly specificity: MediaRangeSpecificity;
}

const QUALITY_PATTERN = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;
const TOKEN_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const OPTIONAL_WHITESPACE_PATTERN = /^[\t ]+|[\t ]+$/g;

/** Runtime contract for one concrete server-offered HTTP media type. */
export const HttpMediaTypeSchema = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter(
      (source) => Option.isSome(parseMediaType(source, false)),
      {
        message:
          "Expected a concrete HTTP media type without a quality weight.",
      }
    )
  ),
  Schema.brand("@Nakafa/HttpMediaType")
);

export type HttpMediaType = Schema.Schema.Type<typeof HttpMediaTypeSchema>;

type SupportedMediaTypes = readonly [HttpMediaType, ...HttpMediaType[]];

/** Selects the highest-ranked supported representation from an Accept header. */
export function negotiateMediaType(
  acceptHeader: Option.Option<string>,
  supportedMediaTypes: SupportedMediaTypes
): Option.Option<HttpMediaType> {
  const ranges = parseAcceptHeader(acceptHeader);
  let best = Option.none<{
    readonly mediaType: HttpMediaType;
    readonly quality: number;
  }>();

  for (const mediaType of supportedMediaTypes) {
    const preference = readMediaPreference(ranges, mediaType);
    if (Option.isNone(preference) || preference.value.quality === 0) {
      continue;
    }
    if (Option.isNone(best) || preference.value.quality > best.value.quality) {
      best = Option.some({
        mediaType,
        quality: preference.value.quality,
      });
    }
  }

  return Option.map(best, ({ mediaType }) => mediaType);
}

/** Checks whether one exact media type is explicitly acceptable. */
export function acceptsExplicitMediaType(
  acceptHeader: Option.Option<string>,
  mediaType: HttpMediaType
) {
  const exactRanges = parseAcceptHeader(acceptHeader).filter(
    (range) => range.type !== "*" && range.subtype !== "*"
  );
  const preference = readMediaPreference(exactRanges, mediaType);
  return Option.exists(preference, ({ quality }) => quality > 0);
}

/** Merges Vary field names case-insensitively without losing existing values. */
export function mergeVaryHeader(
  current: Option.Option<string>,
  required: readonly string[]
) {
  const source = Option.getOrElse(current, () => "");
  const values: string[] = [];
  const names = new Set<string>();

  for (const fieldName of source.split(",")) {
    const value = trimOptionalWhitespace(fieldName);
    const normalized = value.toLowerCase();
    if (!value || names.has(normalized)) {
      continue;
    }
    values.push(value);
    names.add(normalized);
  }

  if (names.has("*")) {
    return "*";
  }

  for (const fieldName of required) {
    const normalized = fieldName.toLowerCase();
    if (names.has(normalized)) {
      continue;
    }
    values.push(fieldName);
    names.add(normalized);
  }

  return values.join(", ");
}

/** Parses valid media ranges and treats malformed ranges as unacceptable. */
function parseAcceptHeader(
  acceptHeader: Option.Option<string>
): readonly ParsedMediaType[] {
  if (Option.isNone(acceptHeader)) {
    return [
      {
        parameters: new Map(),
        quality: 1,
        subtype: "*",
        type: "*",
      },
    ];
  }

  return Option.match(splitOutsideQuotes(acceptHeader.value, ","), {
    onNone: () => [],
    onSome: (sources) => {
      const ranges: ParsedMediaType[] = [];
      for (const source of sources) {
        if (!trimOptionalWhitespace(source)) {
          continue;
        }
        const parsed = parseMediaType(source, true);
        if (Option.isSome(parsed)) {
          ranges.push(parsed.value);
        }
      }
      return ranges;
    },
  });
}

/** Resolves the most specific range controlling one offered representation. */
function readMediaPreference(
  ranges: readonly ParsedMediaType[],
  mediaType: HttpMediaType
): Option.Option<RangePreference> {
  const offered = parseMediaType(mediaType, false);
  if (Option.isNone(offered)) {
    return Option.none();
  }

  let selected = Option.none<RangePreference>();
  for (const range of ranges) {
    const specificity = getSpecificity(range, offered.value);
    if (Option.isNone(specificity)) {
      continue;
    }
    const candidate = {
      quality: range.quality,
      specificity: specificity.value,
    };
    if (Option.isNone(selected) || rangeOutranks(candidate, selected.value)) {
      selected = Option.some(candidate);
    }
  }
  return selected;
}

/** Scores exact, subtype wildcard, and global wildcard matches. */
function getSpecificity(
  range: ParsedMediaType,
  offered: ParsedMediaType
): Option.Option<MediaRangeSpecificity> {
  if (range.type !== "*" && range.type !== offered.type) {
    return Option.none();
  }
  if (range.subtype !== "*" && range.subtype !== offered.subtype) {
    return Option.none();
  }
  for (const [name, value] of range.parameters) {
    if (offered.parameters.get(name) !== value) {
      return Option.none();
    }
  }

  let rank = 2;
  if (range.type === "*") {
    rank = 0;
  } else if (range.subtype === "*") {
    rank = 1;
  }
  return Option.some({
    parameterCount: range.parameters.size,
    rank,
  });
}

/** Gives specific ranges precedence, then uses quality for equivalent ranges. */
function rangeOutranks(candidate: RangePreference, current: RangePreference) {
  if (candidate.specificity.rank !== current.specificity.rank) {
    return candidate.specificity.rank > current.specificity.rank;
  }
  if (
    candidate.specificity.parameterCount !== current.specificity.parameterCount
  ) {
    return (
      candidate.specificity.parameterCount > current.specificity.parameterCount
    );
  }
  return candidate.quality > current.quality;
}

/** Parses one media type or range with validated RFC token parameters. */
function parseMediaType(
  source: string,
  allowsWeight: boolean
): Option.Option<ParsedMediaType> {
  const parts = splitOutsideQuotes(source, ";");
  if (Option.isNone(parts)) {
    return Option.none();
  }

  const [rawMediaType, ...rawParameters] = parts.value;
  const mediaTypeParts = trimOptionalWhitespace(rawMediaType)
    .toLowerCase()
    .split("/");
  if (mediaTypeParts.length !== 2) {
    return Option.none();
  }

  const [type, subtype] = mediaTypeParts;
  const hasValidType = TOKEN_PATTERN.test(type) && TOKEN_PATTERN.test(subtype);
  if (
    !hasValidType ||
    (type === "*" && subtype !== "*") ||
    (!allowsWeight && (type === "*" || subtype === "*"))
  ) {
    return Option.none();
  }

  let quality = 1;
  let hasWeight = false;
  const parameters = new Map<string, string>();
  for (const rawParameter of rawParameters) {
    const parameter = trimOptionalWhitespace(rawParameter);
    if (!parameter) {
      continue;
    }

    const separatorIndex = parameter.indexOf("=");
    if (separatorIndex <= 0) {
      return Option.none();
    }

    const name = parameter.slice(0, separatorIndex).toLowerCase();
    const rawValue = parameter.slice(separatorIndex + 1);
    if (!TOKEN_PATTERN.test(name)) {
      return Option.none();
    }
    if (name === "q") {
      if (!allowsWeight || hasWeight || !QUALITY_PATTERN.test(rawValue)) {
        return Option.none();
      }
      quality = Number(rawValue);
      hasWeight = true;
      continue;
    }

    const value = parseParameterValue(rawValue);
    if (Option.isNone(value) || parameters.has(name)) {
      return Option.none();
    }
    parameters.set(
      name,
      name === "charset" ? value.value.toLowerCase() : value.value
    );
  }

  return Option.some({ parameters, quality, subtype, type });
}

/** Parses one token or quoted-string parameter value for exact matching. */
function parseParameterValue(source: string): Option.Option<string> {
  if (TOKEN_PATTERN.test(source)) {
    return Option.some(source);
  }
  if (!(source.startsWith('"') && source.endsWith('"'))) {
    return Option.none();
  }

  let value = "";
  for (let index = 1; index < source.length - 1; index += 1) {
    const character = source.charAt(index);
    if (character === "\\") {
      index += 1;
      const escaped = source.charAt(index);
      if (index >= source.length - 1 || !isQuotedPairCharacter(escaped)) {
        return Option.none();
      }
      value += escaped;
      continue;
    }
    if (!isQuotedTextCharacter(character)) {
      return Option.none();
    }
    value += character;
  }
  return Option.some(value);
}

/** Splits one HTTP list while preserving delimiters inside quoted strings. */
function splitOutsideQuotes(
  source: string,
  delimiter: "," | ";"
): Option.Option<readonly [string, ...string[]]> {
  let first = "";
  const middle: string[] = [];
  let current = "";
  let escaped = false;
  let hasDelimiter = false;
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
      if (hasDelimiter) {
        middle.push(current);
      } else {
        first = current;
        hasDelimiter = true;
      }
      current = "";
      continue;
    }
    current += character;
  }

  if (quoted) {
    return Option.none();
  }
  if (!hasDelimiter) {
    return Option.some([current]);
  }
  return Option.some([first, ...middle, current]);
}

function trimOptionalWhitespace(source: string) {
  return source.replace(OPTIONAL_WHITESPACE_PATTERN, "");
}

function isQuotedTextCharacter(character: string) {
  const code = character.charCodeAt(0);
  return (
    code === 9 ||
    code === 32 ||
    code === 33 ||
    (code >= 35 && code <= 91) ||
    (code >= 93 && code <= 126) ||
    (code >= 128 && code <= 255)
  );
}

function isQuotedPairCharacter(character: string) {
  const code = character.charCodeAt(0);
  return (
    code === 9 ||
    code === 32 ||
    (code >= 33 && code <= 126) ||
    (code >= 128 && code <= 255)
  );
}

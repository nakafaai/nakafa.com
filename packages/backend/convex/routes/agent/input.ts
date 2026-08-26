import { Effect, Schema } from "effect";

const INTEGER_PATTERN = /^-?\d+$/;

/** Syntactically malformed HTTP input before domain schema validation. */
export class AgentHttpInputError extends Schema.TaggedError<AgentHttpInputError>()(
  "AgentHttpInputError",
  {
    detail: Schema.String,
    resolution: Schema.String,
  }
) {}

/** Builds the search input from typed public query parameters. */
export const readSearchInput = Effect.fn("agent.http.readSearchInput")(
  function* (url: URL) {
    yield* assertAllowedParameters(url, [
      "limit",
      "locale",
      "offset",
      "query",
      "section",
    ]);
    const queries = url.searchParams.getAll("query");
    const [limit, locale, offset, section] = yield* Effect.all([
      readOptionalInteger(url, "limit"),
      readOptionalValue(url, "locale"),
      readOptionalInteger(url, "offset"),
      readOptionalValue(url, "section"),
    ]);
    return {
      ...(limit === undefined ? {} : { limit }),
      ...(locale === undefined ? {} : { locale }),
      ...(offset === undefined ? {} : { offset }),
      ...(queries.length === 0 ? {} : { queries }),
      ...(section === undefined ? {} : { section }),
    };
  }
);

/** Reads the required exact content reference query parameter. */
export const readContentInput = Effect.fn("agent.http.readContentInput")(
  function* (url: URL) {
    yield* assertAllowedParameters(url, ["ref"]);
    const ref = yield* readOptionalValue(url, "ref");
    if (ref !== undefined) {
      return ref;
    }
    return yield* new AgentHttpInputError({
      detail: "The ref query parameter is required.",
      resolution:
        "Pass a content_id from search or a canonical Nakafa URL as ref.",
    });
  }
);

/** Builds the taxonomy input from the optional locale. */
export const readTaxonomyInput = Effect.fn("agent.http.readTaxonomyInput")(
  function* (url: URL) {
    yield* assertAllowedParameters(url, ["locale"]);
    const locale = yield* readOptionalValue(url, "locale");
    return locale === undefined ? {} : { locale };
  }
);

/** Builds the Quran input from its path and query parameters. */
export const readQuranInput = Effect.fn("agent.http.readQuranInput")(function* (
  url: URL,
  rawSurah: string
) {
  yield* assertAllowedParameters(url, [
    "from_verse",
    "include_tafsir",
    "locale",
    "to_verse",
  ]);
  const [fromVerse, includeTafsir, locale, surah, toVerse] = yield* Effect.all([
    readOptionalInteger(url, "from_verse"),
    readOptionalBoolean(url, "include_tafsir"),
    readOptionalValue(url, "locale"),
    readInteger(rawSurah, "surah"),
    readOptionalInteger(url, "to_verse"),
  ]);
  return {
    ...(fromVerse === undefined ? {} : { from_verse: fromVerse }),
    ...(includeTafsir === undefined ? {} : { include_tafsir: includeTafsir }),
    ...(locale === undefined ? {} : { locale }),
    surah,
    ...(toVerse === undefined ? {} : { to_verse: toVerse }),
  };
});

/** Detects a request body that no read-only endpoint accepts. */
export function hasRequestBody(request: Request) {
  const contentLength = request.headers.get("content-length");
  const parsedLength = contentLength === null ? 0 : Number(contentLength);
  return (
    request.body !== null || !Number.isFinite(parsedLength) || parsedLength > 0
  );
}

/** Rejects unknown query parameters so agents can correct misspellings. */
function assertAllowedParameters(url: URL, allowed: readonly string[]) {
  return Effect.gen(function* () {
    for (const key of url.searchParams.keys()) {
      if (allowed.includes(key)) {
        continue;
      }
      return yield* new AgentHttpInputError({
        detail: `Unknown query parameter: ${key}.`,
        resolution: `Use only these query parameters: ${allowed.join(", ")}.`,
      });
    }
  });
}

/** Reads one optional query value and rejects duplicates. */
function readOptionalValue(url: URL, name: string) {
  const values = url.searchParams.getAll(name);
  if (values.length > 1) {
    return Effect.fail(
      new AgentHttpInputError({
        detail: `The ${name} query parameter cannot be repeated.`,
        resolution: `Pass exactly one ${name} value.`,
      })
    );
  }
  return Effect.succeed(values[0]);
}

/** Reads one optional exact integer query parameter. */
const readOptionalInteger = Effect.fn("agent.http.readOptionalInteger")(
  function* (url: URL, name: string) {
    const value = yield* readOptionalValue(url, name);
    return value === undefined ? undefined : yield* readInteger(value, name);
  }
);

/** Reads one optional lowercase boolean query parameter. */
const readOptionalBoolean = Effect.fn("agent.http.readOptionalBoolean")(
  function* (url: URL, name: string) {
    const value = yield* readOptionalValue(url, name);
    if (value === undefined) {
      return;
    }
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
    return yield* new AgentHttpInputError({
      detail: `${name} must be true or false.`,
      resolution: `Pass ${name}=true or ${name}=false.`,
    });
  }
);

/** Parses one canonical base-10 integer without partial coercion. */
function readInteger(value: string, name: string) {
  if (!INTEGER_PATTERN.test(value)) {
    return Effect.fail(
      new AgentHttpInputError({
        detail: `${name} must be an integer.`,
        resolution: `Pass ${name} as a base-10 integer without decimals.`,
      })
    );
  }
  return Effect.succeed(Number(value));
}

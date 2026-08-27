import { parseArgs } from "node:util";
import { NAKAFA_API_BASE_URL } from "@repo/contents/_lib/agent/constants";
import { Effect, Schema } from "effect";
import { InvocationError } from "../error.js";
import { CliRequestSchema, isHttpOrigin } from "./spec.js";

const optionDefinitions = {
  "api-base": { type: "string" },
  "from-verse": { type: "string" },
  help: { short: "h", type: "boolean" },
  limit: { type: "string" },
  locale: { type: "string" },
  offset: { type: "string" },
  pretty: { short: "p", type: "boolean" },
  section: { type: "string" },
  tafsir: { type: "boolean" },
  "to-verse": { type: "string" },
  version: { short: "v", type: "boolean" },
} as const;

const globalOptions = new Set(["api-base", "help", "pretty", "version"]);
const commandOptions = {
  get: new Set<string>(),
  mcp: new Set<string>(),
  quran: new Set(["from-verse", "locale", "tafsir", "to-verse"]),
  search: new Set(["limit", "locale", "offset", "section"]),
  taxonomy: new Set(["locale"]),
};

/** Parses and validates one complete CLI invocation. */
export const readCliRequest = Effect.fn("NakafaCli.readRequest")(function* (
  argv: readonly string[]
) {
  const parsed = yield* Effect.try({
    catch: (cause) => new InvocationError({ message: String(cause) }),
    try: () =>
      parseArgs({
        allowNegative: true,
        allowPositionals: true,
        args: [...argv],
        options: optionDefinitions,
        strict: true,
      }),
  });
  const apiBase = normalizeApiBase(
    readStringOption(parsed.values["api-base"]) ?? NAKAFA_API_BASE_URL
  );
  const pretty = parsed.values.pretty === true;
  if (parsed.values.help === true) {
    return yield* decodeCliRequest({
      apiBase,
      command: { kind: "help" },
      pretty,
    });
  }
  if (parsed.values.version === true) {
    return yield* decodeCliRequest({
      apiBase,
      command: { kind: "version" },
      pretty,
    });
  }
  if (parsed.positionals.length === 0) {
    return yield* decodeCliRequest({
      apiBase,
      command: { kind: "help" },
      pretty,
    });
  }

  const [commandName, ...positionals] = parsed.positionals;
  if (!isCommandName(commandName)) {
    return yield* new InvocationError({
      message: `Unknown command: ${String(commandName)}. Run nakafa --help.`,
    });
  }
  yield* rejectUnsupportedOptions(commandName, parsed.values);
  const command = yield* buildCommand(commandName, positionals, parsed.values);
  return yield* decodeCliRequest({ apiBase, command, pretty });
});

function buildCommand(
  commandName: keyof typeof commandOptions,
  positionals: readonly string[],
  values: Readonly<Record<string, boolean | string | undefined>>
) {
  if (commandName === "search") {
    if (positionals.length === 0) {
      return Effect.fail(
        new InvocationError({ message: "search requires a query." })
      );
    }
    return Effect.succeed({
      kind: "search",
      limit: readNumberOption(values.limit),
      locale: readStringOption(values.locale),
      offset: readNumberOption(values.offset),
      query: positionals.join(" "),
      section: readStringOption(values.section),
    });
  }
  if (commandName === "get") {
    return requireOneArgument(commandName, positionals).pipe(
      Effect.map((ref) => ({ kind: "get", ref }))
    );
  }
  if (commandName === "taxonomy") {
    return requireNoArguments(commandName, positionals).pipe(
      Effect.as({
        kind: "taxonomy",
        locale: readStringOption(values.locale),
      })
    );
  }
  if (commandName === "quran") {
    return requireOneArgument(commandName, positionals).pipe(
      Effect.map((surah) => ({
        fromVerse: readNumberOption(values["from-verse"]),
        includeTafsir: values.tafsir === true,
        kind: "quran",
        locale: readStringOption(values.locale),
        surah: Number(surah),
        toVerse: readNumberOption(values["to-verse"]),
      }))
    );
  }
  return requireNoArguments(commandName, positionals).pipe(
    Effect.as({ kind: "mcp" })
  );
}

function decodeCliRequest(input: unknown) {
  return Schema.decodeUnknownEffect(CliRequestSchema, {
    onExcessProperty: "error",
  })(input).pipe(
    Effect.mapError(
      (cause) =>
        new InvocationError({
          message: `Invalid command options: ${String(cause)}`,
        })
    )
  );
}

function rejectUnsupportedOptions(
  commandName: keyof typeof commandOptions,
  values: Readonly<Record<string, boolean | string | undefined>>
) {
  const allowed = commandOptions[commandName];
  const unsupported = Object.entries(values).find(
    ([name, value]) =>
      value !== undefined && !globalOptions.has(name) && !allowed.has(name)
  );
  if (!unsupported) {
    return Effect.void;
  }
  return Effect.fail(
    new InvocationError({
      message: `--${unsupported[0]} is not valid for ${commandName}.`,
    })
  );
}

function requireOneArgument(
  command: string,
  positionals: readonly string[]
): Effect.Effect<string, InvocationError> {
  if (positionals.length === 1) {
    return Effect.succeed(positionals.join(""));
  }
  return Effect.fail(
    new InvocationError({
      message: `${command} requires exactly one argument.`,
    })
  );
}

function requireNoArguments(
  command: string,
  positionals: readonly string[]
): Effect.Effect<void, InvocationError> {
  if (positionals.length === 0) {
    return Effect.void;
  }
  return Effect.fail(
    new InvocationError({
      message: `${command} does not accept positional arguments.`,
    })
  );
}

function readStringOption(value: boolean | string | undefined) {
  return typeof value === "string" ? value : undefined;
}

function readNumberOption(value: boolean | string | undefined) {
  const source = readStringOption(value);
  return source === undefined ? undefined : Number(source);
}

function normalizeApiBase(value: string) {
  return isHttpOrigin(value) ? new URL(value).origin : value;
}

function isCommandName(
  value: string | undefined
): value is keyof typeof commandOptions {
  return value !== undefined && Object.hasOwn(commandOptions, value);
}

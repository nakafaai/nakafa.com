import { Effect, Option } from "effect";
import { COMMAND_NAME } from "#cli/command/spec";
import { InvocationError } from "#cli/error";

export const FLAG_NAME = {
  apiBase: "api-base",
  fromVerse: "from-verse",
  help: "help",
  limit: "limit",
  locale: "locale",
  offset: "offset",
  pretty: "pretty",
  section: "section",
  tafsir: "tafsir",
  toVerse: "to-verse",
  version: "version",
} as const;
export const FLAG_ALIAS = {
  help: "h",
  pretty: "p",
  version: "v",
} as const;

const ACTION_FLAGS: ReadonlySet<string> = new Set([
  FLAG_NAME.help,
  FLAG_NAME.version,
]);
const COMMAND_NAMES: ReadonlySet<string> = new Set(Object.values(COMMAND_NAME));
const COMMAND_PRESENCE_FLAGS: ReadonlySet<string> = new Set([FLAG_NAME.tafsir]);
const COMMAND_VALUE_FLAGS: ReadonlySet<string> = new Set([
  FLAG_NAME.fromVerse,
  FLAG_NAME.limit,
  FLAG_NAME.locale,
  FLAG_NAME.offset,
  FLAG_NAME.section,
  FLAG_NAME.toVerse,
]);
const PRESENCE_FLAGS: ReadonlySet<string> = new Set([
  FLAG_NAME.pretty,
  ...COMMAND_PRESENCE_FLAGS,
]);
const VALUE_FLAGS: ReadonlySet<string> = new Set([
  FLAG_NAME.apiBase,
  ...COMMAND_VALUE_FLAGS,
]);
type ActionName = typeof FLAG_NAME.help | typeof FLAG_NAME.version;
type CommandName = (typeof COMMAND_NAME)[keyof typeof COMMAND_NAME];
type ShortFlagName =
  | typeof FLAG_NAME.help
  | typeof FLAG_NAME.pretty
  | typeof FLAG_NAME.version;

/** Preserves Nakafa's public argv contract at the native parser boundary. */
export const normalizeArgv = Effect.fn("NakafaCli.normalizeArgv")(function* (
  argv: readonly string[]
) {
  yield* validateActionBoundaries(argv);
  const normalized: string[] = [];
  const actions: Record<ActionName, boolean | undefined> = {
    help: undefined,
    version: undefined,
  };
  let parseFlags = true;

  for (const argument of argv) {
    if (parseFlags && argument === "--") {
      appendActions(normalized, actions);
      normalized.push(argument);
      parseFlags = false;
      continue;
    }
    if (!parseFlags) {
      normalized.push(argument);
      continue;
    }

    const long = readLongFlag(argument);
    if (long !== undefined && isBooleanFlag(long.name)) {
      if (long.value !== undefined) {
        return yield* new InvocationError({
          message: `--${long.sourceName} does not accept a value.`,
        });
      }
      if (isActionFlagName(long.name)) {
        actions[long.name] = !long.negated;
      } else {
        normalized.push(`--${long.name}=${long.negated ? "false" : "true"}`);
      }
      continue;
    }

    const short = readShortFlags(argument);
    if (short !== undefined) {
      if (short.value !== undefined) {
        return yield* new InvocationError({
          message: `-${short.source} does not accept a value.`,
        });
      }
      for (const name of short.names) {
        if (isActionFlagName(name)) {
          actions[name] = true;
        } else {
          normalized.push(`--${name}=true`);
        }
      }
      continue;
    }

    normalized.push(argument);
  }

  if (parseFlags) {
    appendActions(normalized, actions);
  }
  return addRootHelp(moveCommandBeforeFlags(normalized));
});

/** Returns the same invocation without action flags when dry validation is needed. */
export function readActionValidation(argv: readonly string[]) {
  const validation: string[] = [];
  let hasAction = false;
  let parseFlags = true;

  for (const argument of argv) {
    if (argument === "--") {
      parseFlags = false;
      validation.push(argument);
      continue;
    }
    if (parseFlags && isCanonicalActionFlag(argument)) {
      hasAction = true;
      continue;
    }
    validation.push(argument);
  }

  return hasAction ? Option.some(validation) : Option.none();
}

function appendActions(
  target: string[],
  actions: Readonly<Record<ActionName, boolean | undefined>>
) {
  if (actions.help === true) {
    target.push(`--${FLAG_NAME.help}`);
  }
  if (actions.version === true) {
    target.push(`--${FLAG_NAME.version}`);
  }
}

function isActionFlagName(value: string): value is ActionName {
  return ACTION_FLAGS.has(value);
}

function isBooleanFlag(value: string) {
  return isActionFlagName(value) || PRESENCE_FLAGS.has(value);
}

function isCanonicalActionFlag(argument: string) {
  return (
    argument === `--${FLAG_NAME.help}` || argument === `--${FLAG_NAME.version}`
  );
}

function isCommandName(value: string | undefined): value is CommandName {
  return value !== undefined && COMMAND_NAMES.has(value);
}

function moveCommandBeforeFlags(argv: readonly string[]) {
  const separatorIndex = argv.indexOf("--");
  const leading = argv.slice(
    0,
    separatorIndex === -1 ? argv.length : separatorIndex
  );
  const trailing = separatorIndex === -1 ? [] : argv.slice(separatorIndex);
  const leadingCommand = findCommand(leading);

  if (leadingCommand !== undefined) {
    return moveToFront(leading, trailing, leadingCommand);
  }
  const trailingCommand = trailing.at(1);
  if (!isCommandName(trailingCommand)) {
    return [...argv];
  }
  const withCommand = [...leading, trailingCommand];
  const command = findCommand(withCommand);
  return command === undefined
    ? [...argv]
    : moveToFront(withCommand, ["--", ...trailing.slice(2)], command);
}

function findCommand(argv: readonly string[]) {
  let skipValue = false;
  for (const [index, argument] of argv.entries()) {
    if (skipValue) {
      skipValue = false;
      continue;
    }
    const long = readLongFlag(argument);
    if (long !== undefined) {
      if (
        long.negated ||
        !(VALUE_FLAGS.has(long.name) || isBooleanFlag(long.name))
      ) {
        return;
      }
      if (VALUE_FLAGS.has(long.name) && long.value === undefined) {
        const value = argv.at(index + 1);
        if (value === undefined || value.startsWith("-")) {
          return;
        }
        skipValue = true;
      }
      continue;
    }
    if (argument.startsWith("-")) {
      return;
    }
    return isCommandName(argument) ? { index, name: argument } : undefined;
  }
  return;
}

function moveToFront(
  leading: readonly string[],
  trailing: readonly string[],
  command: Readonly<{ index: number; name: CommandName }>
) {
  return [
    command.name,
    ...leading.slice(0, command.index),
    ...leading.slice(command.index + 1),
    ...trailing,
  ];
}

function addRootHelp(argv: readonly string[]) {
  const separatorIndex = argv.indexOf("--");
  if (separatorIndex !== -1 && separatorIndex !== argv.length - 1) {
    return [...argv];
  }
  const source = separatorIndex === -1 ? argv : argv.slice(0, -1);
  if (findCommand(source) !== undefined) {
    return [...argv];
  }

  const rootArgv: string[] = [];
  let hasCommandOption = false;
  let skipValue = false;

  for (const [index, argument] of source.entries()) {
    if (skipValue) {
      skipValue = false;
      continue;
    }
    const long = readLongFlag(argument);
    if (long === undefined || long.negated) {
      return [...argv];
    }
    if (COMMAND_PRESENCE_FLAGS.has(long.name)) {
      hasCommandOption = true;
      continue;
    }
    if (COMMAND_VALUE_FLAGS.has(long.name)) {
      hasCommandOption = true;
      if (long.value === undefined) {
        const value = argv[index + 1];
        if (value === undefined || value.startsWith("-")) {
          return [...argv];
        }
        skipValue = true;
      }
      continue;
    }
    if (long.name === FLAG_NAME.apiBase && long.value === undefined) {
      const value = source[index + 1];
      if (value === undefined || value.startsWith("-")) {
        return [...argv];
      }
      rootArgv.push(argument, value);
      skipValue = true;
      continue;
    }
    if (
      long.name === FLAG_NAME.apiBase ||
      long.name === FLAG_NAME.pretty ||
      isActionFlagName(long.name)
    ) {
      rootArgv.push(argument);
      continue;
    }
    return [...argv];
  }

  if (!hasCommandOption) {
    return [...source];
  }
  if (!rootArgv.some(isCanonicalActionFlag)) {
    rootArgv.push(`--${FLAG_NAME.help}`);
  }
  return rootArgv;
}

const validateActionBoundaries = Effect.fn(
  "NakafaCli.validateActionBoundaries"
)(function* (argv: readonly string[]) {
  for (const [index, argument] of argv.entries()) {
    if (argument === "--") {
      return;
    }
    const long = readLongFlag(argument);
    if (
      long === undefined ||
      long.negated ||
      long.value !== undefined ||
      !VALUE_FLAGS.has(long.name)
    ) {
      continue;
    }
    const value = argv[index + 1];
    if (value !== undefined && isNormalizedBooleanFlag(value)) {
      return yield* new InvocationError({
        message: `--${long.sourceName} requires a value.`,
      });
    }
  }
});

function isNormalizedBooleanFlag(argument: string) {
  const long = readLongFlag(argument);
  return (
    (long !== undefined && isBooleanFlag(long.name)) ||
    readShortFlags(argument) !== undefined
  );
}

function readLongFlag(argument: string) {
  if (!argument.startsWith("--") || argument === "--") {
    return;
  }
  const equalsIndex = argument.indexOf("=");
  const sourceName = argument.slice(
    2,
    equalsIndex === -1 ? undefined : equalsIndex
  );
  const negated = sourceName.startsWith("no-");
  return {
    name: negated ? sourceName.slice(3) : sourceName,
    negated,
    sourceName,
    value: equalsIndex === -1 ? undefined : argument.slice(equalsIndex + 1),
  };
}

function readShortFlags(argument: string) {
  if (
    !argument.startsWith("-") ||
    argument.startsWith("--") ||
    argument === "-"
  ) {
    return;
  }
  const equalsIndex = argument.indexOf("=");
  const source = argument.slice(
    1,
    equalsIndex === -1 ? undefined : equalsIndex
  );
  const names: ShortFlagName[] = [];
  for (const alias of source) {
    const name = readShortFlagName(alias);
    if (name === undefined) {
      return;
    }
    names.push(name);
  }
  return {
    names,
    source,
    value: equalsIndex === -1 ? undefined : argument.slice(equalsIndex + 1),
  };
}

function readShortFlagName(alias: string): ShortFlagName | undefined {
  if (alias === FLAG_ALIAS.help) {
    return FLAG_NAME.help;
  }
  if (alias === FLAG_ALIAS.pretty) {
    return FLAG_NAME.pretty;
  }
  return alias === FLAG_ALIAS.version ? FLAG_NAME.version : undefined;
}

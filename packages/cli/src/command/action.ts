import { Option } from "effect";
import {
  FLAG_ALIAS,
  isCanonicalActionFlag,
  isCommandPresenceFlag,
  isCommandValueFlag,
  readLongFlag,
  readShortArgument,
} from "#cli/command/argv";

/** Returns the same invocation without action flags for native dry validation. */
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
    if (parseFlags) {
      const short = removeShortActions(argument);
      if (short !== undefined) {
        hasAction = true;
        if (short.length > 0) {
          validation.push(short);
        }
        continue;
      }
    }
    validation.push(argument);
  }

  return hasAction ? Option.some(validation) : Option.none();
}

/** Removes one recognized cross-command flag before native action validation. */
export function omitActionValidationFlag(
  argv: readonly string[],
  option: string
) {
  if (!option.startsWith("--")) {
    return Option.none<readonly string[]>();
  }
  const optionName = option.slice(2);
  if (!(isCommandValueFlag(optionName) || isCommandPresenceFlag(optionName))) {
    return Option.none<readonly string[]>();
  }
  const match = argv
    .flatMap((argument, index) => {
      const long = readLongFlag(argument);
      return long === undefined ? [] : [{ index, long }];
    })
    .find(({ long }) => long.name === optionName && !long.negated);
  if (match === undefined) {
    return Option.none<readonly string[]>();
  }
  const { index, long } = match;
  if (isCommandPresenceFlag(optionName) || long.value !== undefined) {
    return Option.some([...argv.slice(0, index), ...argv.slice(index + 1)]);
  }
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("-")) {
    return Option.none<readonly string[]>();
  }
  return Option.some([...argv.slice(0, index), ...argv.slice(index + 2)]);
}

function removeShortActions(argument: string) {
  const short = readShortArgument(argument);
  if (short === undefined) {
    return;
  }
  const validationAliases = [...short.source].filter(
    (alias) => alias !== FLAG_ALIAS.help && alias !== FLAG_ALIAS.version
  );
  if (validationAliases.length === short.source.length) {
    return;
  }
  if (validationAliases.length === 0) {
    return "";
  }
  const value =
    short.positionals === undefined && short.value !== undefined
      ? `=${short.value}`
      : "";
  return `-${validationAliases.join("")}${value}`;
}

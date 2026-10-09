import { Match, Schema } from "effect";
import type { Identifier, Node, SourceFile } from "typescript/unstable/ast";
import {
  isConfiguration,
  isReactModule,
  STRICT_PATTERN,
  TEST_PATTERN,
} from "#scripts/check/kinds";
import type { Binding } from "#scripts/check/source";

/** Every Effect-native source rule, by the id each violation reports. */
export const Rule = Schema.Literals([
  "array-check",
  "array-method",
  "array-mutation",
  "array-search",
  "assertion",
  "clock",
  "console",
  "data-type",
  "env",
  "error-class",
  "fetch",
  "json",
  "map-set",
  "new-promise",
  "node-module",
  "object-helper",
  "promise",
  "random",
  "switch",
  "throw",
  "timer",
  "try-catch",
  "typeof-object",
]);

/**
 * The authored modules a rule inspects: every module (`every`); code outside
 * framework configuration (`code`); code outside framework configuration and
 * React modules, tests included (`logic`); the domain code of the strict
 * Confect and script folders, tests excluded (`domain`); product code, which is
 * outside framework configuration, React modules, and tests (`product`); and
 * source code, which is outside framework configuration and tests, React modules
 * included (`source`).
 */
const RuleScope = Schema.Literals([
  "every",
  "code",
  "logic",
  "domain",
  "product",
  "source",
]);

/** One rule's scope and the Effect-native replacement it names. */
const RuleDefinition = Schema.Struct({
  message: Schema.String,
  scope: RuleScope,
});

/** The scope and message of every rule. */
export const RULES = {
  "array-check": {
    message:
      "narrow with Array.isArray from effect, Predicate, or Schema instead of the global Array.isArray.",
    scope: "code",
  },
  "array-method": {
    message:
      "transform arrays with the Array module from effect, such as Array.map, Array.filter, Array.join, Array.contains, Array.drop, or Array.appendAll, instead of a native array method; take indexes from the callback of Array.map, Array.forEach, or Effect.forEach instead of entries.",
    scope: "code",
  },
  "array-mutation": {
    message:
      "build a new array with the Array module from effect, such as Array.append, Array.sort, and Array.reverse, or collect into a MutableList, instead of changing an array in place.",
    scope: "code",
  },
  "array-search": {
    message:
      "search arrays with Array.findFirst, Array.findLast, Array.findFirstIndex, Array.findLastIndex, Array.get, Array.head, or Array.last from effect, which return an Option, instead of a native find, at, indexOf, or lastIndexOf method.",
    scope: "code",
  },
  assertion: {
    message:
      "narrow the value with a Schema or a Predicate from effect instead of an as, angle-bracket, or non-null assertion.",
    scope: "code",
  },
  clock: {
    message:
      "read time from Clock or DateTime.now in effect, or DateTime.nowUnsafe in synchronous React code, instead of Date.now, Date(), or new Date().",
    scope: "code",
  },
  console: {
    message:
      "log through Effect.log or the Console module in effect instead of console.",
    scope: "code",
  },
  "data-type": {
    message:
      "derive this shape from an Effect Schema with typeof X.Type, or declare a service shape inline in Context.Service, instead of a hand-written interface or object type.",
    scope: "code",
  },
  env: {
    message:
      "read configuration through Config in effect, or in code that Next.js bundles through the record of a readEnvironment call from @repo/utilities/env, instead of process.env; only the bundler-inlined NODE_ENV and NEXT_RUNTIME stay direct.",
    scope: "code",
  },
  "error-class": {
    message:
      "define expected failures with Schema.TaggedError or Data.TaggedError instead of a class that extends Error.",
    scope: "code",
  },
  fetch: {
    message: "call HTTP through HttpClient from effect/http instead of fetch.",
    scope: "code",
  },
  json: {
    message:
      "decode and encode JSON through Schema.fromJsonString instead of JSON.parse or JSON.stringify.",
    scope: "code",
  },
  "map-set": {
    message:
      "use HashMap or HashSet from effect, or MutableHashMap or MutableHashSet for local mutation, instead of a native Map or Set.",
    scope: "code",
  },
  "node-module": {
    message:
      "use FileSystem, Path, and ChildProcess from effect with NodeServices from @effect/platform-node instead of node:fs, node:path, or node:child_process.",
    scope: "code",
  },
  "object-helper": {
    message:
      "use Record.keys, Record.values, Record.toEntries, or Record.fromEntries from effect instead of the Object helper.",
    scope: "code",
  },
  "new-promise": {
    message:
      "build the value with Effect.callback, Effect.promise, or a Deferred from effect, and run it at the framework boundary, instead of new Promise or Promise.withResolvers.",
    scope: "source",
  },
  promise: {
    message:
      "compose Effects with Effect.fn, wrapping a Promise SDK once in Effect.tryPromise, instead of async functions or await.",
    scope: "domain",
  },
  random: {
    message:
      "draw random values from Random in effect instead of Math.random, and draw a UUID with randomUuid from @repo/utilities/uuid, which reads Effect's Crypto service, instead of crypto.randomUUID.",
    scope: "code",
  },
  switch: {
    message:
      "match on the value with Match from effect, such as Match.value with Match.tags, Match.discriminators, or Match.when, instead of a switch statement.",
    scope: "every",
  },
  throw: {
    message:
      "fail with a Schema.TaggedError or Data.TaggedError through the Effect error channel, or return a Result or an Option, instead of a throw statement.",
    scope: "product",
  },
  timer: {
    message:
      "schedule with Effect.sleep, Effect.delay, or Schedule and Duration from effect instead of setTimeout, setInterval, setImmediate, or queueMicrotask outside React modules.",
    scope: "logic",
  },
  "try-catch": {
    message: "model failure with Effect instead of a raw try/catch statement.",
    scope: "every",
  },
  "typeof-object": {
    message:
      "narrow unknown input with Schema or Predicate instead of a typeof-object check.",
    scope: "every",
  },
} satisfies Record<typeof Rule.Type, typeof RuleDefinition.Type>;

const GLOBAL_ONLY: readonly (typeof Binding.Type)[] = ["global"];

/** Whether `rule` inspects the authored module `file`. */
export function covers(
  rule: typeof Rule.Type,
  file: string,
  sourceFile: SourceFile
) {
  return Match.value(RULES[rule].scope).pipe(
    Match.when("every", () => true),
    Match.when("code", () => !isConfiguration(file, sourceFile)),
    Match.when(
      "logic",
      () =>
        !(isConfiguration(file, sourceFile) || isReactModule(file, sourceFile))
    ),
    Match.when(
      "domain",
      () => STRICT_PATTERN.test(file) && !TEST_PATTERN.test(file)
    ),
    Match.when(
      "product",
      () =>
        !(
          isConfiguration(file, sourceFile) ||
          isReactModule(file, sourceFile) ||
          TEST_PATTERN.test(file)
        )
    ),
    Match.when(
      "source",
      () => !(isConfiguration(file, sourceFile) || TEST_PATTERN.test(file))
    ),
    Match.exhaustive
  );
}

/**
 * One construct that breaks `rule` at the line where `node` starts. When the
 * construct names a binding, it counts only while `reference` binds as one of
 * `accepts`, such as a platform global that no import or local shadows.
 */
export function candidate(
  rule: typeof Rule.Type,
  sourceFile: SourceFile,
  node: Node,
  reference?: Identifier,
  accepts = GLOBAL_ONLY
) {
  const { line } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile)
  );
  return { accepts, line: line + 1, reference, rule };
}

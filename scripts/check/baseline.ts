import {
  Array as Arr,
  Effect,
  FileSystem,
  Option,
  Path,
  Record as Rec,
  Result,
  Schema,
  Tuple,
} from "effect";
import { effectFindings, type Finding } from "#scripts/check/effect";
import { readAuthoredSources, readAuthoredTree } from "#scripts/check/files";
import { RULES, Rule } from "#scripts/check/rules";
import { parseSources } from "#scripts/check/source";
import { runEntry } from "#scripts/entry";
import { writeError, writeOutput } from "#scripts/output";

/** The committed baseline, relative to the repository root. */
export const BASELINE_FILE = "scripts/check/baseline.json";

/**
 * Known Effect-native findings, counted per authored module and rule. The
 * check fails on any finding beyond these counts and on any count above the
 * findings that remain, so the baseline only shrinks.
 */
export const Baseline = Schema.Record(
  Schema.String,
  Schema.Record(
    Rule,
    Schema.optionalKey(Schema.Int.check(Schema.isGreaterThan(0)))
  )
);

const BaselineJson = Schema.fromJsonString(Baseline, { space: 2 });

/** The baseline could not be read, decoded, or written. */
export class BaselineError extends Schema.TaggedError<BaselineError>()(
  "BaselineError",
  { cause: Schema.Unknown, message: Schema.String }
) {}

/** Reads the committed baseline; a missing file allows no finding at all. */
export const readBaseline = Effect.fn("RepositoryPolicy.readBaseline")(
  function* (root: string) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const text = yield* fileSystem
      .readFileString(path.join(root, BASELINE_FILE))
      .pipe(
        Effect.catchReason("PlatformError", "NotFound", () =>
          Effect.succeed("{}")
        ),
        Effect.mapError(
          (cause) =>
            new BaselineError({
              cause,
              message: `Unable to read ${BASELINE_FILE}.`,
            })
        )
      );
    return yield* Schema.decodeEffect(BaselineJson)(text, {
      onExcessProperty: "error",
    }).pipe(
      Effect.mapError(
        (cause) =>
          new BaselineError({
            cause,
            message: `${BASELINE_FILE} is not a valid baseline.`,
          })
      )
    );
  }
);

/** Counts findings per authored module and rule, in file and rule order. */
export function countFindings(
  findings: readonly (typeof Finding.Type)[]
): typeof Baseline.Type {
  return Rec.map(
    Arr.groupBy(findings, ({ file }) => file),
    (group) =>
      Rec.fromEntries(
        Arr.filterMap(Rule.literals, (rule) => {
          const count = Arr.countBy(group, (finding) => finding.rule === rule);
          return count === 0
            ? Result.failVoid
            : Result.succeed(Tuple.make(rule, count));
        })
      )
  );
}

/** Returns how many findings of `rule` the baseline allows in `file`. */
function allowance(
  baseline: typeof Baseline.Type,
  file: string,
  rule: typeof Rule.Type
) {
  return Option.getOrElse(
    Option.flatMap(Rec.get(baseline, file), (rules) =>
      Option.fromUndefinedOr(rules[rule])
    ),
    () => 0
  );
}

/**
 * Compares findings with the baseline. A finding of a module and rule whose
 * count exceeds the baseline is new; a baseline count above the findings that
 * remain is stale and must shrink.
 */
export function ratchet(
  findings: readonly (typeof Finding.Type)[],
  baseline: typeof Baseline.Type
) {
  const counts = countFindings(findings);
  const found = (file: string, rule: typeof Rule.Type) =>
    allowance(counts, file, rule);
  const exceeded = Arr.filterMap(findings, (finding) => {
    const allowed = allowance(baseline, finding.file, finding.rule);
    const count = found(finding.file, finding.rule);
    return count > allowed
      ? Result.succeed({ ...finding, allowed, count })
      : Result.failVoid;
  });
  const stale = Arr.flatMap(Rec.keys(baseline), (file) =>
    Arr.filterMap(Rule.literals, (rule) => {
      const allowed = allowance(baseline, file, rule);
      const remaining = found(file, rule);
      return remaining < allowed
        ? Result.succeed({ allowed, file, remaining, rule })
        : Result.failVoid;
    })
  );
  return { exceeded, stale };
}

/** Describes each finding beyond the baseline with the Effect replacement it needs. */
export function exceededMessages(
  exceeded: ReturnType<typeof ratchet>["exceeded"]
) {
  return Arr.map(exceeded, ({ allowed, count, file, line, rule }) => {
    const known =
      allowed === 0
        ? ""
        : ` This module has ${count} ${rule} findings and ${BASELINE_FILE} allows ${allowed}.`;
    return `${file}:${line}: ${RULES[rule].message} (${rule})${known}`;
  });
}

/** Describes each baseline count that must shrink to the findings that remain. */
export function staleMessages(stale: ReturnType<typeof ratchet>["stale"]) {
  return Arr.map(
    stale,
    ({ allowed, file, remaining, rule }) =>
      `${BASELINE_FILE}: ${file} allows ${allowed} ${rule} findings but ${remaining} remain. Run pnpm check:baseline to shrink it.`
  );
}

/**
 * Rewrites the baseline to the findings that remain. It refuses to record a
 * finding beyond the current baseline, so the baseline only shrinks.
 */
export const updateBaseline = Effect.fn("RepositoryPolicy.updateBaseline")(
  function* (root: string) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const { scripts, workspaces } = yield* readAuthoredTree(root);
    const sources = yield* readAuthoredSources(
      root,
      Arr.appendAll(workspaces, scripts)
    );
    const findings = yield* Effect.scoped(
      Effect.flatMap(parseSources(sources), effectFindings)
    );
    const { exceeded } = ratchet(findings, yield* readBaseline(root));
    if (!Arr.isReadonlyArrayEmpty(exceeded)) {
      yield* writeError(
        `${Arr.join(exceededMessages(exceeded), "\n")}\nFix these findings first; the baseline never records a new one.\n`
      );
      return 1;
    }
    const counts = countFindings(findings);
    const text = yield* Schema.encodeEffect(BaselineJson)(counts).pipe(
      Effect.orDie
    );
    yield* fileSystem
      .writeFileString(path.join(root, BASELINE_FILE), `${text}\n`)
      .pipe(
        Effect.mapError(
          (cause) =>
            new BaselineError({
              cause,
              message: `Unable to write ${BASELINE_FILE}.`,
            })
        )
      );
    yield* writeOutput(
      `${BASELINE_FILE} records ${Arr.length(findings)} findings in ${Rec.size(counts)} modules.\n`
    );
    return 0;
  }
);

runEntry(import.meta.main, updateBaseline(process.cwd()));

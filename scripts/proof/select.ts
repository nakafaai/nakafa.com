import {
  HeadSha,
  SpecPath,
} from "@repo/backend/scripts/content/acceptance/result";
import {
  Array as Arr,
  Effect,
  HashSet,
  Option,
  Order,
  Result,
  Schema,
  String as Str,
} from "effect";
import { runEntry } from "#scripts/entry";
import { writeOutput } from "#scripts/output";
import { runText } from "#scripts/process";
import { ProofError } from "#scripts/proof/client";

/** A spec file of the browser suites, as a path in the repository; its group is the path under `apps/www`. */
const SPEC_FILE = /^apps\/www\/(?<spec>e2e\/.+\.browser\.ts)$/u;

/**
 * The one spec every merge group proves, and the only one a change to nothing
 * the product runs is proven on, such as the proof scripts, a workflow or the
 * docs: a fast page that passes in all three engines on main (run 43699251319).
 */
export const SMOKE_SPEC = "e2e/quran/landing.browser.ts";

/** The source of the app, whose path segments name the spec folders a change reaches. */
const SOURCE_ROOT = "apps/www/src/";

/** A file extension, which the last segment of a source path drops before it names a folder. */
const EXTENSION = /\.[^.]+$/u;

const USAGE = "Usage: node scripts/proof/select.ts <base sha> <head sha>";

/** The spec files among repository paths, as paths under `apps/www`. */
const specsOf = (paths: readonly string[]) =>
  Arr.filterMap(paths, (path) =>
    Option.match(Option.fromNullishOr(SPEC_FILE.exec(path)?.groups?.spec), {
      onNone: () => Result.failVoid,
      onSome: Result.succeed,
    })
  );

/** The path segments of the app source files among the changed paths, each file named without its extension. */
const sourceSegments = (changed: readonly string[]) =>
  HashSet.fromIterable(
    Arr.flatMap(changed, (path) =>
      path.startsWith(SOURCE_ROOT)
        ? Arr.map(Str.split(path.slice(SOURCE_ROOT.length), "/"), (segment) =>
            Str.replace(EXTENSION, "")(segment)
          )
        : []
    )
  );

/**
 * The specs a merge group proves, sorted: every spec file it changes that the
 * head still has, every spec in an e2e folder whose name is a segment of a
 * changed app source path, such as `e2e/quran` for
 * `apps/www/src/routes/$locale/quran/index.tsx`, and the smoke spec. A group
 * that changes nothing the product runs reaches no folder, so it proves its
 * own spec files and the smoke spec.
 */
export function selectSpecs(
  changed: readonly string[],
  present: readonly string[]
) {
  const specs = specsOf(present);
  const touched = HashSet.fromIterable(specsOf(changed));
  const segments = sourceSegments(changed);
  return Arr.sort(
    Arr.dedupe([
      SMOKE_SPEC,
      ...Arr.filter(
        specs,
        (spec) =>
          HashSet.has(touched, spec) ||
          Option.exists(Arr.get(Str.split(spec, "/"), 1), (folder) =>
            HashSet.has(segments, folder)
          )
      ),
    ]),
    Order.String
  );
}

/** The lines Git printed, one path each. */
const lines = (text: string) =>
  Arr.filter(Str.split(text, "\n"), (line) => line !== "");

/** Runs one Git command in this checkout and returns what it printed, or fails with what it said. */
const git = Effect.fn("proof.selectGit")(function* (args: readonly string[]) {
  const output = yield* runText("git", args).pipe(
    Effect.mapError(() => new ProofError({ message: "Git could not start." }))
  );
  if (output.code !== 0) {
    return yield* new ProofError({
      message: `git ${Arr.join(Arr.take(args, 1), " ")} failed: ${output.stderr.trim()}`,
    });
  }
  return lines(output.stdout);
});

/**
 * Prints the specs a merge group proves, separated by spaces, from the paths
 * that change between its base and its head and the spec files its head holds.
 * Both commits must be in this checkout.
 */
export const selectGroup = Effect.fn("proof.selectGroup")(function* (
  argv: readonly string[]
) {
  const [base, head] = yield* Schema.decodeUnknownEffect(
    Schema.Tuple([HeadSha, HeadSha])
  )(argv).pipe(Effect.mapError(() => new ProofError({ message: USAGE })));
  const changed = yield* git([
    "diff",
    "--name-only",
    "--no-renames",
    base,
    head,
  ]);
  const present = yield* git([
    "ls-tree",
    "-r",
    "--name-only",
    head,
    "--",
    "apps/www/e2e",
  ]);
  const specs = yield* Schema.decodeEffect(Schema.Array(SpecPath))(
    selectSpecs(changed, present)
  ).pipe(
    Effect.mapError(
      () => new ProofError({ message: "A selected spec is not a spec path." })
    )
  );
  yield* writeOutput(`${Arr.join(specs, " ")}\n`);
});

runEntry(import.meta.main, selectGroup(Arr.drop(process.argv, 2)));

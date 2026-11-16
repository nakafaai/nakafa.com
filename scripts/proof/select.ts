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
  Tuple,
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

/** A support module of the browser suites, which every spec and support module imports as `@/e2e/support/<name>`. */
const SUPPORT_FILE = /^apps\/www\/e2e\/support\/(?<name>.+)\.ts$/u;

/** One import of a support module, as `git grep -o` prints it: `<head>:<importer>:@/e2e/support/<name>`. */
const SUPPORT_IMPORT =
  /^[^:]+:(?<importer>apps\/www\/e2e\/[^:]+\.ts):@\/e2e\/support\/(?<name>[A-Za-z0-9/_-]+)$/u;

/** What every spec runs under, so a change to it reaches every spec. */
const CONFIG_FILE = "apps/www/playwright.config.ts";

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

/** The support module a path names, when it is one: a unit test beside a support module is not. */
const supportName = (path: string) =>
  Option.match(
    Option.filter(
      Option.fromNullishOr(SUPPORT_FILE.exec(path)?.groups?.name),
      (name) => !name.endsWith(".test")
    ),
    { onNone: () => Result.failVoid, onSome: Result.succeed }
  );

/** The imports of support modules among the lines `git grep -o` printed, each `[importer, name]`. */
export const supportImports = (lines: readonly string[]) =>
  Arr.filterMap(lines, (line) =>
    Option.match(Option.fromNullishOr(SUPPORT_IMPORT.exec(line)?.groups), {
      onNone: () => Result.failVoid,
      onSome: ({ importer, name }) =>
        Result.succeed(Tuple.make(importer, name)),
    })
  );

/**
 * The files that import, directly or through other support modules, one of
 * the support modules `names`: each round adds the support modules among the
 * importers, until a round adds none.
 */
const importersOf = (
  imports: readonly (readonly [string, string])[],
  names: HashSet.HashSet<string>
): HashSet.HashSet<string> => {
  const importers = HashSet.fromIterable(
    Arr.filterMap(imports, ([importer, name]) =>
      HashSet.has(names, name) ? Result.succeed(importer) : Result.failVoid
    )
  );
  const reached = HashSet.union(
    names,
    HashSet.fromIterable(
      Arr.filterMap(Arr.fromIterable(importers), supportName)
    )
  );
  return HashSet.size(reached) === HashSet.size(names)
    ? importers
    : importersOf(imports, reached);
};

/**
 * The specs a merge group proves, sorted: every spec file it changes that the
 * head still has, every spec in an e2e folder whose name is a segment of a
 * changed app source path, such as `e2e/quran` for
 * `apps/www/src/routes/$locale/quran/index.tsx`, every spec that imports a
 * changed support module directly or through another (`imports`, each
 * `[importer, name]`), and the smoke spec; a change to the Playwright config
 * proves every spec. A group that changes nothing the product or the suites
 * run proves its own spec files and the smoke spec.
 */
export function selectSpecs(
  changed: readonly string[],
  present: readonly string[],
  imports: readonly (readonly [string, string])[] = []
) {
  const specs = specsOf(present);
  const touched = HashSet.fromIterable(specsOf(changed));
  const segments = sourceSegments(changed);
  const supported = HashSet.fromIterable(
    specsOf(
      Arr.fromIterable(
        importersOf(
          imports,
          HashSet.fromIterable(Arr.filterMap(changed, supportName))
        )
      )
    )
  );
  const everySpec = Arr.contains(changed, CONFIG_FILE);
  return Arr.sort(
    Arr.dedupe([
      SMOKE_SPEC,
      ...Arr.filter(
        specs,
        (spec) =>
          everySpec ||
          HashSet.has(touched, spec) ||
          HashSet.has(supported, spec) ||
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

/**
 * Runs one Git command in this checkout and returns what it printed, or fails
 * with what it said. `none` names the exit code that means "nothing found",
 * as `git grep` answers 1, which reads as no lines.
 */
const git = Effect.fn("proof.selectGit")(function* (
  args: readonly string[],
  none?: number
) {
  const output = yield* runText("git", args).pipe(
    Effect.mapError(() => new ProofError({ message: "Git could not start." }))
  );
  if (output.code === none) {
    return [];
  }
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
  // The support modules' importers are read only when the group changes one.
  const imports = Arr.some(changed, (path) =>
    Result.isSuccess(supportName(path))
  )
    ? supportImports(
        yield* git(
          [
            "grep",
            "-o",
            "-E",
            "@/e2e/support/[A-Za-z0-9/_-]+",
            head,
            "--",
            "apps/www/e2e",
          ],
          1
        )
      )
    : [];
  const specs = yield* Schema.decodeEffect(Schema.Array(SpecPath))(
    selectSpecs(changed, present, imports)
  ).pipe(
    Effect.mapError(
      () => new ProofError({ message: "A selected spec is not a spec path." })
    )
  );
  yield* writeOutput(`${Arr.join(specs, " ")}\n`);
});

runEntry(import.meta.main, selectGroup(Arr.drop(process.argv, 2)));

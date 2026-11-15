import {
  Array as Arr,
  Effect,
  HashMap,
  Option,
  Ref,
  Schema,
  String as Str,
} from "effect";
import type { ChildProcessSpawner } from "effect/process";
import { runEntry } from "#scripts/entry";
import { attempt, decoded, gh, run } from "#scripts/landing/command";
import { Pull, stacksOf } from "#scripts/landing/stack";
import { TrainError } from "#scripts/landing/train";
import { writeOutput } from "#scripts/output";
import { REPOSITORY } from "#scripts/proof/client";

const USAGE = "Usage: bun run freshen <pull-request-number...>";

const Numbers = Schema.NonEmptyArray(
  Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThan(0))
);

const PullListJson = Schema.fromJsonString(Schema.Array(Pull));

/** A member whose merge with the head below it conflicts, and the files that conflict. */
const Conflict = Schema.Struct({
  number: Schema.Int,
  files: Schema.Array(Schema.String),
});

/**
 * What freshening did to one stack, named by its bottom pull request: the
 * members it merged, the member it stopped at, and the top head it gated.
 */
const Freshening = Schema.Struct({
  stack: Schema.Int,
  merged: Schema.Array(Schema.Int),
  conflict: Schema.Option(Conflict),
  gated: Schema.Option(Schema.String),
});
type Freshening = typeof Freshening.Type;

/** One run of freshen: the main it merged, each stack, and each named pull request no open stack holds. */
const FreshenReport = Schema.Struct({
  main: Schema.String,
  stacks: Schema.Array(Freshening),
  missing: Schema.Array(Schema.Int),
});
type FreshenReport = typeof FreshenReport.Type;

/** The pull requests the command line names, at least one. */
export const parseFreshenArguments = Effect.fn("freshen.parseArguments")(
  function* (argv: readonly string[]) {
    return yield* Schema.decodeUnknownEffect(Numbers)(argv);
  },
  Effect.mapError(() => new TrainError({ message: USAGE }))
);

/**
 * Brings every open stack that holds a named pull request up to today's main,
 * bottom-up, without touching a working tree: each member that does not
 * contain the head below it (main, for the bottom) gets a merge commit built
 * with `git merge-tree` and `git commit-tree`, pushed as a fast-forward of its
 * branch, and the top's new head is gated. A merge that conflicts stops its
 * stack at that member and names the files, for a person to merge once. A
 * member two stacks share is merged once.
 */
export const freshen = Effect.fn("freshen.run")(function* (
  root: string,
  numbers: readonly number[]
) {
  const git = (args: readonly string[]) =>
    run("git", args, root).pipe(Effect.map(Str.trim));
  const pulls = yield* gh([
    "pr",
    "list",
    "--repo",
    REPOSITORY,
    "--state",
    "open",
    "--limit",
    "200",
    "--json",
    "number,headRefOid,headRefName,baseRefName,title,isDraft,files",
  ]).pipe(Effect.flatMap(decoded(PullListJson)));
  const stacks = Arr.filter(stacksOf(pulls), (stack) =>
    Arr.some(stack, (pull) => Arr.contains(numbers, pull.number))
  );
  const held = Arr.flatMap(stacks, (stack) =>
    Arr.map(stack, (pull) => pull.number)
  );
  const tip = Arr.headNonEmpty(
    Str.split(yield* git(["ls-remote", "origin", "refs/heads/main"]), "\t")
  );
  yield* git([
    "fetch",
    "--quiet",
    "origin",
    "refs/heads/main",
    ...Arr.map(Arr.dedupe(held), (number) => `refs/pull/${number}/head`),
  ]);
  // The new head of each member already merged, for a stack that shares it.
  const heads = yield* Ref.make(HashMap.empty<number, string>());

  const contains = (ancestor: string, head: string) =>
    attempt("git", ["merge-base", "--is-ancestor", ancestor, head], root).pipe(
      Effect.map((output) => output.code === 0)
    );

  const merge = Effect.fn("freshen.merge")(function* (
    member: Pull,
    base: { readonly sha: string; readonly name: string }
  ) {
    const tree = yield* attempt(
      "git",
      [
        "merge-tree",
        "--write-tree",
        "--name-only",
        "--no-messages",
        member.headRefOid,
        base.sha,
      ],
      root
    );
    const lines = Str.split(Str.trim(tree.stdout), "\n");
    if (tree.code === 1) {
      return { _tag: "conflict" as const, files: Arr.tailNonEmpty(lines) };
    }
    if (tree.code !== 0) {
      return yield* new TrainError({
        message: `git merge-tree failed on #${member.number}: ${tree.stderr.trim()}`,
      });
    }
    const sha = yield* git([
      "commit-tree",
      Arr.headNonEmpty(lines),
      "-p",
      member.headRefOid,
      "-p",
      base.sha,
      "-m",
      `Merge ${base.name} into ${member.headRefName}`,
    ]);
    yield* git([
      "push",
      "--quiet",
      "origin",
      `${sha}:refs/heads/${member.headRefName}`,
    ]);
    yield* Ref.update(heads, HashMap.set(member.number, sha));
    return { _tag: "merged" as const, sha };
  });

  const climb = (
    stack: Arr.NonEmptyReadonlyArray<Pull>,
    members: readonly Pull[],
    base: { readonly sha: string; readonly name: string },
    merged: readonly number[]
  ): Effect.Effect<
    Freshening,
    TrainError,
    ChildProcessSpawner.ChildProcessSpawner
  > =>
    Effect.gen(function* () {
      const finished = (
        conflict: Option.Option<typeof Conflict.Type>,
        gated: Option.Option<string>
      ): Freshening => ({
        stack: Arr.headNonEmpty(stack).number,
        merged,
        conflict,
        gated,
      });
      const [member, ...rest] = members;
      if (member === undefined) {
        if (merged.length === 0) {
          return finished(Option.none(), Option.none());
        }
        yield* gh([
          "workflow",
          "run",
          "proof.yml",
          "--repo",
          REPOSITORY,
          "--ref",
          "main",
          "-f",
          `sha=${base.sha}`,
          "-f",
          "proof=false",
        ]);
        return finished(Option.none(), Option.some(base.sha));
      }
      const next = (sha: string) => ({ sha, name: member.headRefName });
      const done = HashMap.get(yield* Ref.get(heads), member.number);
      if (Option.isSome(done)) {
        return yield* climb(stack, rest, next(done.value), merged);
      }
      if (yield* contains(base.sha, member.headRefOid)) {
        return yield* climb(stack, rest, next(member.headRefOid), merged);
      }
      const outcome = yield* merge(member, base);
      if (outcome._tag === "conflict") {
        return finished(
          Option.some({ number: member.number, files: outcome.files }),
          Option.none()
        );
      }
      return yield* climb(
        stack,
        rest,
        next(outcome.sha),
        Arr.append(merged, member.number)
      );
    });

  const report: FreshenReport = {
    main: tip,
    stacks: yield* Effect.forEach(stacks, (stack) =>
      climb(stack, stack, { sha: tip, name: "main" }, [])
    ),
    missing: Arr.filter(numbers, (number) => !Arr.contains(held, number)),
  };
  return report;
});

/** The report of one run: per stack what merged, where it stopped and what it gated. */
export function formatFreshen(report: FreshenReport) {
  const numbered = (numbers: readonly number[]) =>
    Arr.join(
      Arr.map(numbers, (number) => `#${number}`),
      " "
    );
  return Arr.join(
    [
      `Freshened on main ${report.main.slice(0, 10)}`,
      ...Arr.map(
        report.stacks,
        ({ conflict, gated, merged, stack }) =>
          `stack #${stack}: ${Arr.join(
            [
              ...(merged.length > 0
                ? [`merged ${numbered(merged)}`]
                : Option.match(conflict, {
                    onNone: () => ["nothing to merge"],
                    onSome: () => [],
                  })),
              ...Option.match(conflict, {
                onNone: () => [],
                onSome: ({ files, number }) => [
                  `#${number} conflicts in ${Arr.join(files, ", ")}: merge the head below into it by hand, then run freshen again`,
                ],
              }),
              ...Option.match(gated, {
                onNone: () => [],
                onSome: (sha) => [`gating ${sha.slice(0, 10)}`],
              }),
            ],
            "; "
          )}`
      ),
      ...Arr.map(
        report.missing,
        (number) => `#${number}: no open stack holds it`
      ),
      "",
    ],
    "\n"
  );
}

/** Runs freshen from this checkout for the pull requests the command line names. */
export const runFreshenCli = Effect.fn("freshen.cli")(function* (
  root: string,
  argv: readonly string[]
) {
  const numbers = yield* parseFreshenArguments(argv);
  yield* writeOutput(formatFreshen(yield* freshen(root, numbers)));
});

runEntry(
  import.meta.main,
  runFreshenCli(`${import.meta.dirname}/../..`, Arr.drop(process.argv, 2))
);

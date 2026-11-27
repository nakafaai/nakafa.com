import {
  Array as Arr,
  Effect,
  FileSystem,
  HashSet,
  Order,
  Path,
  Result,
  String as Str,
} from "effect";
import type { SourceFile } from "tsrs/ast";
import { RepositoryReadError } from "#scripts/check/files";
import type { LabFinding } from "#scripts/check/labs";
import { inspectLabSource } from "#scripts/check/labs";

/**
 * The lab folders that still draw what the engine owns, one per line. The list
 * only shrinks: a folder that passes takes its line out in the change that
 * converts it.
 */
export const PENDING_FILE = "scripts/check/pending.txt";
const COMMENT_PATTERN = /^#/u;

/** The folders a pending list names, in its order, without comments and blank lines. */
function listedFolders(text: string) {
  return Arr.filter(
    Arr.map(Arr.fromIterable(Str.linesIterator(text)), Str.trim),
    (line) => Str.isNonEmpty(line) && !COMMENT_PATTERN.test(line)
  );
}

/**
 * Judges the lab findings against the pending list. A listed folder is
 * skipped; a folder that is not listed must pass; a listed folder that passes,
 * or that no longer exists, must leave the list. The list stays sorted with
 * each folder once, so parallel changes that each delete their own line merge
 * without a conflict, and an empty list is deleted with the mechanism.
 */
export function pendingFindings(
  findings: readonly (typeof LabFinding.Type)[],
  text: string
): readonly string[] {
  const listed = listedFolders(text);
  const pending = HashSet.fromIterable(listed);
  const failing = HashSet.fromIterable(
    Arr.map(findings, ({ folder }) => folder)
  );
  const order = Arr.isReadonlyArrayEmpty(listed)
    ? [
        `${PENDING_FILE}: the list is empty: delete it, and the pending list in scripts/check/pending.ts and scripts/check/tests.ts.`,
      ]
    : Arr.filterMap(
        Arr.zip(listed, Arr.drop(listed, 1)),
        ([previous, folder]) =>
          Order.String(previous, folder) >= 0
            ? Result.succeed(
                `${PENDING_FILE}: ${folder} is out of order or listed twice: keep the list sorted, each folder once.`
              )
            : Result.failVoid
      );
  const passed = Arr.filterMap(listed, (folder) =>
    HashSet.has(failing, folder)
      ? Result.failVoid
      : Result.succeed(
          `${PENDING_FILE}: ${folder} passes the lab rule: remove this line.`
        )
  );
  const unlisted = Arr.filterMap(findings, ({ folder, message }) =>
    HashSet.has(pending, folder) ? Result.failVoid : Result.succeed(message)
  );
  return Arr.flatten([unlisted, order, passed]);
}

/**
 * Applies the lab rule to the parsed modules of the repository at `root`, with
 * its pending list. A repository without the list holds no pending folder.
 */
export const inspectLabs = Effect.fn("RepositoryPolicy.inspectLabs")(function* (
  root: string,
  modules: readonly {
    readonly file: string;
    readonly sourceFile: SourceFile;
  }[]
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.join(root, PENDING_FILE);
  const findings = Arr.flatMap(modules, ({ file: module, sourceFile }) =>
    inspectLabSource(module, sourceFile)
  );
  if (!(yield* fileSystem.exists(file))) {
    return Arr.map(findings, ({ message }) => message);
  }
  const text = yield* fileSystem
    .readFileString(file)
    .pipe(
      Effect.mapError(
        (cause) =>
          new RepositoryReadError({ cause, message: `Unable to read ${file}.` })
      )
    );
  return pendingFindings(findings, text);
});

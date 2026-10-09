import { readAssembly } from "@repo/backend/scripts/refs/assembly";
import { isPublicLeaf } from "@repo/backend/scripts/refs/leaf";
import { loadLeafGroups } from "@repo/backend/scripts/refs/load";
import { leafPaths } from "@repo/backend/scripts/refs/paths";
import { renderDomainModule } from "@repo/backend/scripts/refs/render";
import {
  Array as Arr,
  Effect,
  FileSystem,
  Path,
  Record,
  Result,
  Schema,
} from "effect";

/** Where the generator reads the assembled spec, writes the refs modules, and finds the leaves. */
export const RefsTarget = Schema.Struct({
  backendRoot: Schema.String,
  outputDirectory: Schema.String,
  specPath: Schema.String,
});

/**
 * Writes one refs module per domain that holds a public function, from the leaves
 * that the assembled spec imports. A module of a domain that no longer holds one
 * is deleted. Returns the file names that the run expects in the output folder.
 */
export const generateRefs = Effect.fn("RefsGenerate.generateRefs")(function* (
  target: typeof RefsTarget.Type
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const source = yield* fs.readFileString(target.specPath);
  const leaves = yield* leafPaths(yield* readAssembly(source));
  const groups = yield* loadLeafGroups(
    target.backendRoot,
    path.dirname(target.specPath),
    Arr.map(leaves, (leaf) => leaf.specifier)
  );
  const publicLeaves = Arr.filterMap(
    Arr.zip(leaves, groups),
    ([leaf, group]) =>
      isPublicLeaf(group) ? Result.succeed(leaf) : Result.failVoid
  );
  const domains = Record.toEntries(
    Arr.groupBy(publicLeaves, (leaf) => leaf.segments[0])
  );
  const expected = Arr.map(domains, ([domain]) => `${domain}.ts`);

  yield* fs.makeDirectory(target.outputDirectory, { recursive: true });
  yield* Effect.forEach(
    domains,
    ([domain, domainLeaves]) =>
      fs.writeFileString(
        path.join(target.outputDirectory, `${domain}.ts`),
        renderDomainModule(domain, domainLeaves)
      ),
    { discard: true }
  );
  const existing = yield* fs.readDirectory(target.outputDirectory);
  yield* Effect.forEach(
    Arr.filter(
      existing,
      (entry) => entry.endsWith(".ts") && !Arr.contains(expected, entry)
    ),
    (entry) => fs.remove(path.join(target.outputDirectory, entry)),
    { discard: true }
  );
  yield* Effect.log(
    `Wrote ${expected.length} refs modules for ${publicLeaves.length} leaves with public functions.`
  );
  return expected;
});

import { readAssembly } from "@repo/backend/scripts/refs/assembly";
import { holdsVisibility } from "@repo/backend/scripts/refs/leaf";
import { loadLeafGroups } from "@repo/backend/scripts/refs/load";
import { leafPaths } from "@repo/backend/scripts/refs/paths";
import { renderDomainModule } from "@repo/backend/scripts/refs/render";
import type { FunctionVisibility } from "convex/server";
import {
  Array as Arr,
  Effect,
  FileSystem,
  Path,
  Record,
  Result,
  Schema,
} from "effect";

/**
 * The file of a domain's refs of each visibility. Public refs suit every reader, the
 * browser included; internal refs go in a module only the server reads, so a server
 * module that calls one domain's functions imports that domain's specs, not the whole spec.
 */
const MODULE_SUFFIX: { readonly [Visibility in FunctionVisibility]: string } = {
  internal: ".server.ts",
  public: ".ts",
};

/** Where the generator reads the assembled spec, writes the refs modules, and finds the leaves. */
const RefsTarget = Schema.Struct({
  backendRoot: Schema.String,
  outputDirectory: Schema.String,
  specPath: Schema.String,
});

/**
 * Writes one refs module per domain and visibility that the domain holds a function
 * of, from the leaves that the assembled spec imports. A module that no domain needs
 * any more is deleted. Returns the file names that the run expects in the output folder.
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
  const leafGroups = Arr.zip(leaves, groups);
  const modules = Arr.flatMap(
    Record.toEntries(MODULE_SUFFIX),
    ([visibility, suffix]) => {
      const visible = Arr.filterMap(leafGroups, ([leaf, group]) =>
        holdsVisibility(group, visibility)
          ? Result.succeed(leaf)
          : Result.failVoid
      );
      return Arr.map(
        Record.toEntries(Arr.groupBy(visible, (leaf) => leaf.segments[0])),
        ([domain, domainLeaves]) => ({
          file: `${domain}${suffix}`,
          source: renderDomainModule(domain, domainLeaves, visibility),
        })
      );
    }
  );
  const expected = Arr.map(modules, (module) => module.file);

  yield* fs.makeDirectory(target.outputDirectory, { recursive: true });
  yield* Effect.forEach(
    modules,
    (module) =>
      fs.writeFileString(
        path.join(target.outputDirectory, module.file),
        module.source
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
    `Wrote ${expected.length} refs modules for ${leaves.length} leaves.`
  );
  return expected;
});

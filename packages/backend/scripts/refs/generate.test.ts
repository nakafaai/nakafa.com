import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { generateRefs } from "@repo/backend/scripts/refs/generate";
import { Array as Arr, Effect, FileSystem, Order, Path } from "effect";

/** The backend package root, found from this test file's folder. */
const backendRoot = Effect.gen(function* () {
  const path = yield* Path.Path;
  const folder = yield* path.fromFileUrl(new URL("./", import.meta.url));
  return path.resolve(folder, "../..");
});

describe("generateRefs", () => {
  it.live(
    "writes the public domains and deletes the module of a retired one",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* backendRoot;
        const directory = yield* fs.makeTempDirectoryScoped({
          prefix: "refs-generate-test-",
        });
        const outputDirectory = path.join(directory, "refs");
        yield* fs.makeDirectory(outputDirectory, { recursive: true });
        yield* fs.writeFileString(
          path.join(outputDirectory, "retired.ts"),
          "export {};\n"
        );

        const expected = yield* generateRefs({
          backendRoot: root,
          outputDirectory,
          specPath: path.join(root, "confect", "_generated", "spec.ts"),
        });

        expect(expected).toContain("access.ts");
        expect(expected).not.toContain("storage.ts");
        expect(
          Arr.sort(yield* fs.readDirectory(outputDirectory), Order.String)
        ).toEqual(Arr.sort(expected, Order.String));
      }).pipe(Effect.provide(nodeServicesLayer)),
    60_000
  );

  it.live(
    "fails with both group paths, before loading any leaf, when a leaf file and its nesting differ",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* backendRoot;
        const directory = yield* fs.makeTempDirectoryScoped({
          prefix: "refs-mismatch-test-",
        });
        const specPath = path.join(directory, "_generated", "spec.ts");
        yield* fs.makeDirectory(path.dirname(specPath), { recursive: true });
        yield* fs.writeFileString(
          specPath,
          `import { GroupSpec, Spec } from "@confect/core";
import nina_turns from "../nina/turns.spec";
const spec: Spec.Spec<{}> = Spec.make().addAt("nina", GroupSpec.makeAt("nina").addGroupAt("other", nina_turns));
export default spec;
`
        );

        expect(
          yield* generateRefs({
            backendRoot: root,
            outputDirectory: path.join(directory, "refs"),
            specPath,
          }).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "RefsNestingError",
          derivedPath: "nina.turns",
          nestedPath: "nina.other",
          specifier: "../nina/turns.spec",
        });
      }).pipe(Effect.provide(nodeServicesLayer)),
    60_000
  );
});

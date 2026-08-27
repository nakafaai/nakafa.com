import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
import { readFirstPartySourceFiles } from "./source.ts";

describe("dependency source discovery", () => {
  it.effect("includes TypeScript module variants and excludes JavaScript", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const root = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "dependency-source-test-",
      });
      yield* fileSystem.makeDirectory(`${root}/apps/example`, {
        recursive: true,
      });
      yield* fileSystem.makeDirectory(`${root}/packages/example`, {
        recursive: true,
      });
      yield* fileSystem.writeFileString(
        `${root}/apps/example/entry.mts`,
        'import "temporary-dependency";\n'
      );
      yield* fileSystem.writeFileString(
        `${root}/packages/example/worker.cts`,
        'require("temporary-dependency");\n'
      );
      yield* fileSystem.writeFileString(
        `${root}/packages/example/ignored.js`,
        'import "temporary-dependency";\n'
      );

      const files = yield* readFirstPartySourceFiles(root);

      expect(files.map(({ path }) => path).sort()).toEqual([
        "apps/example/entry.mts",
        "packages/example/worker.cts",
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
  );
});

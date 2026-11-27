import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Path, Record as Rec } from "effect";
import {
  catalogueFindings,
  ENGINE_DIRECTORY,
  inspectCatalogue,
} from "#scripts/check/catalogue";
import { LAB_PAGE } from "#scripts/check/labs";

/** The finding for an engine folder that the page leaves out. */
function missing(folder: string) {
  return `${LAB_PAGE}: three/${folder} is not in the catalogue: name it with what it gives and when a lab uses it.`;
}

/** The finding for a module the page names that the engine does not hold. */
function stale(module: string) {
  return `${LAB_PAGE}: three/${module} names no module of ${ENGINE_DIRECTORY}: remove it, or land the module first.`;
}

/** Writes some files into a fresh repository and inspects its catalogue. */
const inspectRepository = Effect.fn("CatalogueTest.inspectRepository")(
  function* (
    files: Readonly<Record<string, string>>,
    folders: readonly string[]
  ) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* fileSystem.makeTempDirectoryScoped({
      prefix: "catalogue-",
    });
    yield* Effect.forEach(folders, (folder) =>
      fileSystem.makeDirectory(path.join(root, folder), { recursive: true })
    );
    yield* Effect.forEach(Rec.toEntries(files), ([file, text]) =>
      fileSystem.writeFileString(path.join(root, file), text)
    );
    return yield* inspectCatalogue(root);
  }
);

describe("lab page catalogue", () => {
  it("passes a page that names every engine folder and only engine modules", () => {
    assert.deepStrictEqual(
      catalogueFindings(
        "| `three/form` | shapes |\n| `three/arrow` | arrows |",
        [
          { directory: true, name: "form" },
          { directory: false, name: "arrow.tsx" },
          { directory: false, name: "names.test.ts" },
        ]
      ),
      []
    );
  });

  it("reports an engine folder the page leaves out and a module the page names that does not exist", () => {
    assert.deepStrictEqual(
      catalogueFindings("`three/sky` `three/form` `three/optic` three/flora", [
        { directory: true, name: "form" },
        { directory: true, name: "matter" },
      ]),
      [missing("matter"), stale("optic"), stale("sky")]
    );
  });

  it.effect(
    "reads the engine folder and the page, and has nothing to catalogue without the engine",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspectRepository(
            {
              [LAB_PAGE]: "`three/form`",
              [`${ENGINE_DIRECTORY}/arrow.tsx`]: "",
            },
            [
              "docs/adr",
              `${ENGINE_DIRECTORY}/form`,
              `${ENGINE_DIRECTORY}/matter`,
            ]
          ),
          [missing("matter")]
        );
        assert.deepStrictEqual(
          yield* inspectRepository({}, [`${ENGINE_DIRECTORY}/form`]),
          [missing("form")]
        );
        assert.deepStrictEqual(yield* inspectRepository({}, []), []);
        const error = yield* Effect.flip(
          inspectRepository({}, [LAB_PAGE, `${ENGINE_DIRECTORY}/form`])
        );
        assert.strictEqual(error._tag, "RepositoryReadError");
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );
});

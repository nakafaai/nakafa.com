import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { LAB_PAGE } from "#scripts/check/labs";
import {
  inspectLabs,
  PENDING_FILE,
  pendingFindings,
} from "#scripts/check/pending";
import { parseSources } from "#scripts/check/source";

const CONTENTS = "packages/design-system/components/contents";
const LENS = `${CONTENTS}/physics/lens`;
const PRISM = `${CONTENTS}/physics/prism`;
const RAY = `${CONTENTS}/physics/ray`;
const HEADER = "# Lab folders that still draw what the engine owns.\n";

/** One finding of the lab rule in a folder. */
function finding(folder: string) {
  return { folder, message: `${folder}/scene.tsx:1: bare` };
}

/** Writes a pending list into a fresh repository and inspects one lab module there. */
const inspectRepository = Effect.fn("PendingTest.inspectRepository")(function* (
  list: string | undefined
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fileSystem.makeTempDirectoryScoped({
    prefix: "pending-",
  });
  if (list !== undefined) {
    yield* fileSystem.makeDirectory(path.join(root, "scripts/check"), {
      recursive: true,
    });
    yield* fileSystem.writeFileString(path.join(root, PENDING_FILE), list);
  }
  const { modules } = yield* parseSources([
    {
      file: `${LENS}/scene.tsx`,
      sourceText: "export const Lens = () => <boxGeometry />;\n",
    },
  ]);
  return yield* inspectLabs(root, modules);
});

describe("lab pending list", () => {
  it("skips listed folders and reports the findings of folders that are not listed", () => {
    assert.deepStrictEqual(
      pendingFindings(
        [finding(LENS), finding(PRISM)],
        `${HEADER}\n${LENS}\n  \n`
      ),
      [`${PRISM}/scene.tsx:1: bare`]
    );
  });

  it("asks to remove the line of a listed folder that passes", () => {
    assert.deepStrictEqual(
      pendingFindings([finding(LENS)], `${HEADER}${LENS}\n${RAY}\n`),
      [`${PENDING_FILE}: ${RAY} passes the lab rule: remove this line.`]
    );
  });

  it("keeps the list sorted with each folder once", () => {
    assert.deepStrictEqual(
      pendingFindings(
        [finding(LENS), finding(PRISM)],
        `${HEADER}${PRISM}\n${LENS}\n${LENS}\n`
      ),
      [
        `${PENDING_FILE}: ${LENS} is out of order or listed twice: keep the list sorted, each folder once.`,
        `${PENDING_FILE}: ${LENS} is out of order or listed twice: keep the list sorted, each folder once.`,
      ]
    );
  });

  it("asks to delete an empty list with its mechanism", () => {
    assert.deepStrictEqual(pendingFindings([], HEADER), [
      `${PENDING_FILE}: the list is empty: delete it, and the pending list in scripts/check/pending.ts and scripts/check/tests.ts.`,
    ]);
  });

  it.effect(
    "reads the list of a repository, and holds every folder to the rule without one",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspectRepository(`${HEADER}${LENS}\n`),
          []
        );
        assert.deepStrictEqual(yield* inspectRepository(undefined), [
          `${LENS}/scene.tsx:1: <boxGeometry> is drawn in a lab: build the part in components/three/form (<Sweep>, <Turn>) or the kit it belongs to and compose it here (${LAB_PAGE}).`,
        ]);
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect("fails with a read error when the list cannot be read", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "pending-unreadable-",
      });
      yield* fileSystem.makeDirectory(path.join(root, PENDING_FILE), {
        recursive: true,
      });
      const error = yield* Effect.flip(inspectLabs(root, []));
      assert.strictEqual(error._tag, "RepositoryReadError");
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );
});

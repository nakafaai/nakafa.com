import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { loadLeafGroups } from "@repo/backend/scripts/refs/load";
import { Effect, Path, Record } from "effect";

/** The backend package root, found from this test file's folder. */
const backendRoot = Effect.gen(function* () {
  const path = yield* Path.Path;
  const folder = yield* path.fromFileUrl(new URL("./", import.meta.url));
  return path.resolve(folder, "../..");
});

describe("loadLeafGroups", () => {
  it.live(
    "loads the group that a leaf spec default-exports, relative to the spec folder",
    () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const root = yield* backendRoot;
        const [group] = yield* loadLeafGroups(
          root,
          path.join(root, "confect", "_generated"),
          ["../access/grants.spec"]
        );
        expect(Record.keys(group.functions)).toContain("list");
      }).pipe(Effect.provide(nodeServicesLayer)),
    60_000
  );

  it.live(
    "fails with the specifier of a leaf file that does not exist",
    () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const root = yield* backendRoot;
        expect(
          yield* loadLeafGroups(
            root,
            path.join(root, "confect", "_generated"),
            ["../missing/leaf.spec"]
          ).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "RefsLoadError",
          message: expect.stringContaining(
            "Unable to load ../missing/leaf.spec"
          ),
        });
      }).pipe(Effect.provide(nodeServicesLayer)),
    60_000
  );
});

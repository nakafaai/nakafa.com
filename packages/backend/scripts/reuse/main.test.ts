import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import type { markModules } from "@repo/backend/scripts/reuse/mark";
import { Effect, Path } from "effect";

/** What the entry program can fail with: its marker's failures and the path lookup's. */
type EntryError =
  | Effect.Error<ReturnType<typeof markModules>>
  | Effect.Error<ReturnType<Path.Path["fromFileUrl"]>>;

const mocks = vi.hoisted(() => {
  let entry: Effect.Effect<void, EntryError> | undefined;
  return {
    getEntry: () => entry,
    mark: vi.fn<typeof markModules>(),
    runMain: vi.fn((program: Effect.Effect<void, EntryError>) => {
      entry = program;
    }),
  };
});
vi.mock("@effect/platform-node/NodeRuntime", () => ({
  runMain: mocks.runMain,
}));
vi.mock("@repo/backend/scripts/reuse/mark", () => ({
  markModules: mocks.mark,
}));

describe("reuse codegen entry", () => {
  it.live("marks the modules under the backend package's convex folder", () =>
    Effect.gen(function* () {
      mocks.mark.mockReturnValue(Effect.void);
      yield* Effect.promise(() => import("@repo/backend/scripts/reuse/main"));
      const entry = yield* Effect.fromNullishOr(mocks.getEntry());
      yield* entry;

      const path = yield* Path.Path;
      const backendRoot = path.resolve(
        yield* path.fromFileUrl(new URL("../../", import.meta.url))
      );
      expect(mocks.mark).toHaveBeenCalledWith(path.join(backendRoot, "convex"));
    }).pipe(Effect.provide(nodeServicesLayer))
  );
});

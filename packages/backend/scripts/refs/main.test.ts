import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import type { generateRefs } from "@repo/backend/scripts/refs/generate";
import { Effect, Path } from "effect";

/** What the entry program can fail with: its generator's failures and the path lookup's. */
type EntryError =
  | Effect.Error<ReturnType<typeof generateRefs>>
  | Effect.Error<ReturnType<Path.Path["fromFileUrl"]>>;

const mocks = vi.hoisted(() => {
  let entry: Effect.Effect<void, EntryError> | undefined;
  return {
    generate: vi.fn<typeof generateRefs>(),
    getEntry: () => entry,
    runMain: vi.fn((program: Effect.Effect<void, EntryError>) => {
      entry = program;
    }),
  };
});
vi.mock("@effect/platform-node/NodeRuntime", () => ({
  runMain: mocks.runMain,
}));
vi.mock("@repo/backend/scripts/refs/generate", () => ({
  generateRefs: mocks.generate,
}));

describe("refs codegen entry", () => {
  it.live(
    "regenerates the refs under the backend package's confect folder",
    () =>
      Effect.gen(function* () {
        mocks.generate.mockReturnValue(Effect.void);
        yield* Effect.promise(() => import("@repo/backend/scripts/refs/main"));
        const entry = yield* Effect.fromNullishOr(mocks.getEntry());
        yield* entry;

        const path = yield* Path.Path;
        const backendRoot = path.resolve(
          yield* path.fromFileUrl(new URL("../../", import.meta.url))
        );
        const generated = path.join(backendRoot, "confect", "_generated");
        expect(mocks.generate).toHaveBeenCalledWith({
          backendRoot,
          outputDirectory: path.join(generated, "refs"),
          specPath: path.join(generated, "spec.ts"),
        });
      }).pipe(Effect.provide(nodeServicesLayer))
  );
});

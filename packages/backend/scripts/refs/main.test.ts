import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Path } from "effect";

const mocks = vi.hoisted(() => {
  let entry: Effect.Effect<unknown, unknown> | undefined;
  return {
    generate: vi.fn(),
    getEntry: () => entry,
    runMain: vi.fn((program: Effect.Effect<unknown, unknown>) => {
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

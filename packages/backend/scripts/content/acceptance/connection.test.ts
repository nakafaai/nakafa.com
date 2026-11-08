import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  connectionMode,
  seedConnection,
} from "@repo/backend/scripts/content/acceptance/connection";
import { localConvexDouble } from "@repo/backend/test/acceptance";
import { nodePlatform } from "@repo/backend/test/platform";
import { Effect } from "effect";

const mocks = vi.hoisted(() => ({ layer: vi.fn() }));
vi.mock(
  "@repo/backend/scripts/content/acceptance/convex",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@repo/backend/scripts/content/acceptance/convex")
    >()),
    localConvexLayer: mocks.layer,
  })
);

describe("acceptance connection", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "stores the Classroom connection of the school in the state it names",
    () =>
      Effect.gen(function* () {
        const backend = localConvexDouble();

        yield* seedConnection("acc-1", "reconnect").pipe(
          Effect.provide(backend.layer)
        );

        expect(backend.paths()).toEqual(["connectors/seed:connection"]);
        expect(backend.argsOf("connectors/seed:connection")).toEqual({
          slug: "acc-1",
          status: "reconnect",
        });
      })
  );

  it.effect("runs what the mode names against the runtime of the root", () =>
    Effect.gen(function* () {
      const backend = localConvexDouble();
      mocks.layer.mockReturnValue(backend.layer);

      yield* connectionMode.run("/root", ["acc-1", "reconnect"]);

      expect(backend.argsOf("connectors/seed:connection")).toEqual({
        slug: "acc-1",
        status: "reconnect",
      });
      expect(mocks.layer).toHaveBeenCalledWith("/root");
    }).pipe(Effect.provide(nodePlatform))
  );

  it.effect("refuses the mode without its arguments", () =>
    Effect.gen(function* () {
      expect(
        yield* connectionMode.run("/root", []).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message:
          "Usage: acceptance connection <school-slug> <active|reconnect>",
      });
      expect(mocks.layer).not.toHaveBeenCalled();
    }).pipe(Effect.provide(nodePlatform))
  );
});

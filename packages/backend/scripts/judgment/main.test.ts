import { afterEach, describe, expect, it } from "@effect/vitest";
import type { loadCustomerEnvProvider } from "@repo/backend/scripts/customers/convex";
import type {
  measureSet,
  togetherOf,
} from "@repo/backend/scripts/judgment/measure";
import { ConfigProvider, Effect } from "effect";

/** What the entry program can fail with: the failures of its three steps. */
type EntryError =
  | Effect.Error<ReturnType<typeof togetherOf>>
  | Effect.Error<ReturnType<typeof loadCustomerEnvProvider>>
  | Effect.Error<ReturnType<typeof measureSet>>;

const mocks = vi.hoisted(() => {
  let entry: Effect.Effect<void, EntryError> | undefined;
  return {
    getEntry: () => entry,
    measure: vi.fn<typeof measureSet>(),
    provider: vi.fn<typeof loadCustomerEnvProvider>(),
    runMain: vi.fn((program: Effect.Effect<void, EntryError>) => {
      entry = program;
    }),
    together: vi.fn<typeof togetherOf>(),
  };
});
vi.mock("@effect/platform-node/NodeRuntime", () => ({
  runMain: mocks.runMain,
}));
vi.mock("@repo/backend/scripts/customers/convex", () => ({
  loadCustomerEnvProvider: mocks.provider,
}));
vi.mock("@repo/backend/scripts/judgment/measure", () => ({
  measureSet: mocks.measure,
  togetherOf: mocks.together,
}));

const argv = process.argv;

afterEach(() => {
  process.argv = argv;
  process.exitCode = 0;
  vi.restoreAllMocks();
});

describe("the judgment measuring command", () => {
  it.live(
    "measures the development deployment unless it is given --prod, prints the report, and exits with the number of failures as 1",
    () =>
      Effect.gen(function* () {
        const written = vi
          .spyOn(process.stdout, "write")
          .mockImplementation(() => true);
        process.argv = ["node", "main.ts", "--together=3"];
        mocks.together.mockReturnValue(Effect.succeed(3));
        mocks.provider.mockReturnValue(
          Effect.succeed(ConfigProvider.fromEnvRecord({}))
        );
        mocks.measure.mockReturnValue(
          Effect.succeed({ failed: 2, report: "the report" })
        );
        yield* Effect.promise(
          () => import("@repo/backend/scripts/judgment/main")
        );
        yield* yield* Effect.fromNullishOr(mocks.getEntry());
        expect(mocks.together).toHaveBeenCalledExactlyOnceWith([
          "--together=3",
        ]);
        expect(mocks.measure).toHaveBeenCalledExactlyOnceWith(false, 3);
        expect(written).toHaveBeenCalledExactlyOnceWith("the report\n");
        expect(process.exitCode).toBe(1);
      })
  );

  it.live(
    "measures production when it is given --prod, and exits with 0 when nothing failed",
    () =>
      Effect.gen(function* () {
        const written = vi
          .spyOn(process.stdout, "write")
          .mockImplementation(() => true);
        process.argv = ["node", "main.ts", "--prod"];
        mocks.together.mockReturnValue(Effect.succeed(1));
        mocks.provider.mockReturnValue(
          Effect.succeed(ConfigProvider.fromEnvRecord({}))
        );
        mocks.measure.mockReturnValue(
          Effect.succeed({ failed: 0, report: "all good" })
        );
        yield* Effect.promise(
          () => import("@repo/backend/scripts/judgment/main")
        );
        yield* yield* Effect.fromNullishOr(mocks.getEntry());
        expect(mocks.measure).toHaveBeenLastCalledWith(true, 1);
        expect(written).toHaveBeenLastCalledWith("all good\n");
        expect(process.exitCode).toBe(0);
      })
  );
});

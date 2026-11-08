import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  recordTransfer,
  transferMode,
} from "@repo/backend/scripts/content/acceptance/transfer";
import { localConvexDouble } from "@repo/backend/test/acceptance";
import { nodePlatform } from "@repo/backend/test/platform";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

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

const PATH = "billing/contracts:recordInvoiceTransfer";

describe("acceptance transfer", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "records the bank transfer of the invoice, dated at the moment it is recorded",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(1_800_000_000_000);
        const backend = localConvexDouble();

        yield* recordTransfer("INV-2026-0001", "TRF-1").pipe(
          Effect.provide(backend.layer)
        );

        expect(backend.argsOf(PATH)).toEqual({
          number: "INV-2026-0001",
          paidAt: 1_800_000_000_000,
          reference: "TRF-1",
        });
      })
  );

  it.effect(
    "records the transfer the mode names against the runtime of the root",
    () =>
      Effect.gen(function* () {
        const backend = localConvexDouble();
        mocks.layer.mockReturnValue(backend.layer);

        yield* transferMode.run("/root", ["INV-2026-0001", "TRF-1", "ignored"]);

        expect(backend.argsOf(PATH)).toMatchObject({
          number: "INV-2026-0001",
          reference: "TRF-1",
        });
        expect(mocks.layer).toHaveBeenCalledWith("/root");
      }).pipe(Effect.provide(nodePlatform))
  );

  it.effect("refuses the transfer mode without its bank reference", () =>
    Effect.gen(function* () {
      expect(
        yield* transferMode.run("/root", ["INV-2026-0001"]).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: "Usage: acceptance transfer <invoice-number> <bank-reference>",
      });
    }).pipe(Effect.provide(nodePlatform))
  );
});

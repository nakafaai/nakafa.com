import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Data, Effect, Schema } from "effect";
import { saveLedger, saveReadiness } from "@/components/tenant/graduation/save";
import type { GraduationOverview } from "@/components/tenant/graduation/workbook";

const mocks = vi.hoisted(() => ({
  ledger: vi.fn(),
  readiness: vi.fn(),
  report: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/components/tenant/graduation/download", () => ({
  downloadLedger: mocks.ledger,
  downloadReadiness: mocks.readiness,
}));

vi.mock("@/lib/analytics/client", () => ({
  reportClientException: mocks.report,
}));

vi.mock("@repo/design-system/lib/toast/notify", () => ({
  toast: { error: mocks.toastError },
}));

/** The failure of a workbook that the browser could not save. */
class SaveFailed extends Data.TaggedError("SaveFailed") {}

const slug = Schema.decodeSync(TenantSlug)("harapan");
const cohortId = Schema.decodeUnknownSync(Id("tenantCohorts"))("ix-a");

/** A graduating class group's page with no decision yet. */
const overview: GraduationOverview = {
  can: [],
  cohort: {
    id: cohortId,
    name: "IX-A",
    period: "Genap",
    periodId: Schema.decodeUnknownSync(Id("tenantPeriods"))("genap"),
  },
  decision: null,
  suggested: "2027-06-07",
  unit: { name: "SMP Nakafa", npsn: null },
};

describe("saveReadiness", () => {
  it.effect(
    "saves the readiness workbook through the loaded export module",
    () =>
      Effect.gen(function* () {
        mocks.readiness.mockReturnValue(Effect.void);
        yield* saveReadiness(slug, overview);
        expect(mocks.readiness).toHaveBeenCalledWith(slug, overview);
        expect(mocks.toastError).not.toHaveBeenCalled();
      })
  );
});

describe("saveLedger", () => {
  it.effect(
    "reports a workbook that could not be saved and tells the viewer",
    () =>
      Effect.gen(function* () {
        mocks.ledger.mockReturnValue(Effect.fail(new SaveFailed()));
        mocks.report.mockReturnValue(Effect.void);
        yield* saveLedger(slug, { id: cohortId, name: "IX-A" });
        expect(mocks.report).toHaveBeenCalledWith(expect.any(SaveFailed), {
          source: "components/tenant/graduation/save",
        });
        expect(mocks.toastError).toHaveBeenCalledWith({
          title: "school-graduation-export-failed.title",
        });
      })
  );
});

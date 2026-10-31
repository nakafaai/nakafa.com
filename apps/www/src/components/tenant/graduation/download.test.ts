import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Schema } from "effect";
import {
  downloadLedger,
  downloadReadiness,
} from "@/components/tenant/graduation/download";

const client = vi.hoisted(() => ({ query: vi.fn() }));
const writer = vi.hoisted(() => ({
  toFile: vi.fn(),
  write: vi.fn(),
}));

vi.mock("@/lib/convex/client", () => ({
  readConvexClient: () => client,
}));

vi.mock("write-excel-file/browser", () => ({
  default: (sheets: unknown) => {
    writer.write(sheets);
    return { toFile: writer.toFile };
  },
}));

const slug = Schema.decodeSync(TenantSlug)("harapan");
const cohortId = Schema.decodeUnknownSync(Id("tenantCohorts"))("ix-a");
const periodId = Schema.decodeUnknownSync(Id("tenantPeriods"))("genap");

describe("downloadReadiness", () => {
  it.effect(
    "reads every page of the readiness rows and saves the workbook",
    () =>
      Effect.gen(function* () {
        client.query
          .mockResolvedValueOnce({
            continueCursor: "next",
            isDone: false,
            page: [],
          })
          .mockResolvedValueOnce({
            continueCursor: "end",
            isDone: true,
            page: [],
          });
        yield* downloadReadiness(slug, {
          can: [],
          cohort: {
            id: cohortId,
            name: "IX-A",
            period: "Genap",
            periodId,
          },
          decision: null,
          suggested: "2027-06-07",
          unit: { name: "SMP Nakafa", npsn: null },
        });
        expect(client.query).toHaveBeenNthCalledWith(
          2,
          expect.anything(),
          expect.objectContaining({
            paginationOpts: { cursor: "next", numItems: 100 },
          })
        );
        expect(writer.toFile).toHaveBeenCalledWith("e-ijazah-ix-a.xlsx");
      })
  );
});

describe("downloadLedger", () => {
  it.effect(
    "reads the class group's report data and saves the Dapodik workbook",
    () =>
      Effect.gen(function* () {
        client.query.mockResolvedValueOnce({
          continueCursor: "end",
          isDone: true,
          page: [{ name: "Siti", nisn: null, subjects: null }],
        });
        yield* downloadLedger(slug, { id: cohortId, name: "IX-A" });
        expect(writer.write).toHaveBeenLastCalledWith([
          {
            data: [
              ["No", "Nama Peserta Didik", "NISN"],
              [1, "Siti", null],
            ],
            sheet: "Legger",
          },
        ]);
        expect(writer.toFile).toHaveBeenLastCalledWith(
          "dapodik-nilai-ix-a.xlsx"
        );
      })
  );
});

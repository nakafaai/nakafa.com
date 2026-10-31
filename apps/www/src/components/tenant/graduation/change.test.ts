import type { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import type records from "@repo/backend/confect/_generated/refs/records";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";
import { decideChange } from "@/components/tenant/graduation/change";
import type { GraduationOverview } from "@/components/tenant/graduation/workbook";

const slug = Schema.decodeSync(TenantSlug)("sekolah");
const periodOf = Schema.decodeUnknownSync(Id("tenantPeriods"));
const cohortOf = Schema.decodeUnknownSync(Id("tenantCohorts"));
const genap = periodOf("genap");
const ganjil = periodOf("ganjil");

/** The decision the principal records. */
const DECISION = {
  date: "2027-06-07",
  decision: "421.3/045/SMP.1/2027",
  head: "Dra. Siti Aminah, M.Pd.",
  place: "Bandung",
};

/** A class group's page of one period, with its decision or none. */
const overview = (
  name: string,
  periodId: typeof genap,
  decision: GraduationOverview["decision"]
): GraduationOverview => ({
  can: ["graduation.decide", "graduation.issue"],
  cohort: { id: cohortOf(name), name, period: "Genap", periodId },
  decision,
  suggested: "2027-06-07",
  unit: { name: "SMP Nakafa", npsn: null },
});

/** What the store records of one write: the page it stores. */
type Written = Option.Option<Ref.Returns<typeof records.graduations.get>>;

describe("decideChange", () => {
  it("shows the decision on every class group of its period, keeping the letters it issued", () => {
    const getAllQueries = vi.fn();
    getAllQueries.mockReturnValue([
      { args: { slug }, value: Option.some(overview("IX-A", genap, null)) },
      {
        args: { slug },
        value: Option.some(overview("IX-B", genap, { ...DECISION, issued: 3 })),
      },
      { args: { slug }, value: Option.some(overview("VI-A", ganjil, null)) },
      { args: { slug }, value: Option.none() },
    ]);
    const setQuery =
      vi.fn<(ref: unknown, args: unknown, value: Written) => void>();
    decideChange(
      { getAllQueries, getQuery: vi.fn(), setQuery },
      { ...DECISION, nip: "196501011990032001", periodId: genap, slug }
    );
    expect(setQuery).toHaveBeenCalledTimes(2);
    expect(
      Option.getOrThrow(setQuery.mock.calls[0]?.[2] ?? Option.none()).decision
    ).toEqual({ ...DECISION, issued: 0, nip: "196501011990032001" });
    expect(
      Option.getOrThrow(setQuery.mock.calls[1]?.[2] ?? Option.none()).decision
    ).toMatchObject({ issued: 3 });
  });
});

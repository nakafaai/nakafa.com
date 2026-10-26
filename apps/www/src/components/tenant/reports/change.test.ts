import type { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import type records from "@repo/backend/confect/_generated/refs/records";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";
import {
  type ReportLine,
  stateChange,
  writeChange,
} from "@/components/tenant/reports/change";

const slug = Schema.decodeSync(TenantSlug)("sekolah");
const cohortOf = Schema.decodeUnknownSync(Id("tenantCohorts"));
const personOf = Schema.decodeUnknownSync(Id("tenantPeople"));
const reportOf = Schema.decodeUnknownSync(Id("reportCards"));
const x1 = cohortOf("x-1");
const x2 = cohortOf("x-2");
const raka = personOf("raka");
const sari = personOf("sari");

/** A line of the list: a student, their report or none, and what the viewer may do. */
const line = (
  personId: typeof raka,
  report: ReportLine["report"],
  can: ReportLine["can"] = ["report.write"]
): ReportLine => ({
  can,
  report,
  student: { id: personId, name: personId === raka ? "Raka" : "Sari" },
});

/** A draft of Sari's report. */
const sariDraft: ReportLine["report"] = {
  approvedAt: null,
  hash: null,
  id: reportOf("report-sari"),
  note: "Rajin.",
  state: "draft",
};

/** The arguments of one page of a cohort's report list. */
const pageArgs = (cohortId: typeof x1) => ({
  cohortId,
  paginationOpts: { cursor: null, numItems: 50 },
  slug,
});

/** What the store records of one write: the report list page it stores. */
type Written = Option.Option<Ref.Returns<typeof records.reports.sheet>>;

/** A store that holds the given pages and records what is written. */
const storeOf = (pages: unknown[]) => {
  const getAllQueries = vi.fn();
  getAllQueries.mockReturnValue(pages);
  const setQuery =
    vi.fn<(ref: unknown, args: unknown, value: Written) => void>();
  return {
    localStore: { getAllQueries, getQuery: vi.fn(), setQuery },
    setQuery,
  };
};

/** The page that one recorded write stored. */
const written = (setQuery: ReturnType<typeof storeOf>["setQuery"], call = 0) =>
  Option.getOrThrow(setQuery.mock.calls[call]?.[2] ?? Option.none()).page;

describe("writeChange", () => {
  it("starts a draft at the first note, keeps a draft's ID, and touches only its own cohort", () => {
    const { localStore, setQuery } = storeOf([
      {
        args: pageArgs(x1),
        value: Option.some({
          isDone: true,
          page: [
            line(raka, null),
            line(sari, sariDraft, ["report.complete", "report.write"]),
          ],
        }),
      },
      { args: pageArgs(x2), value: Option.some({ isDone: true, page: [] }) },
      { args: pageArgs(x1), value: Option.none() },
    ]);
    writeChange(localStore, {
      cohortId: x1,
      note: "Teliti.",
      personId: raka,
      slug,
    });
    expect(setQuery).toHaveBeenCalledTimes(1);
    const [started, kept] = written(setQuery);
    expect(started).toMatchObject({
      can: ["report.write", "report.complete"],
      report: { approvedAt: null, note: "Teliti.", state: "draft" },
    });
    expect(kept).toEqual(
      line(sari, sariDraft, ["report.complete", "report.write"])
    );
    writeChange(localStore, {
      cohortId: x1,
      note: "Lagi.",
      personId: sari,
      slug,
    });
    expect(written(setQuery, 1)[1]).toMatchObject({
      can: ["report.complete", "report.write"],
      report: { id: sariDraft.id, note: "Lagi." },
    });
  });
});

describe("stateChange", () => {
  it("moves the report it names to its next state on every list, and leaves the rest", () => {
    const { localStore, setQuery } = storeOf([
      {
        args: pageArgs(x1),
        value: Option.some({
          isDone: true,
          page: [line(raka, null), line(sari, sariDraft)],
        }),
      },
      {
        args: pageArgs(x2),
        value: Option.some({ isDone: true, page: [line(raka, null)] }),
      },
    ]);
    stateChange("completed")(localStore, { reportId: sariDraft.id, slug });
    expect(setQuery).toHaveBeenCalledTimes(2);
    const [untouched, moved] = written(setQuery);
    expect(untouched).toEqual(line(raka, null));
    expect(moved?.report).toMatchObject({
      id: sariDraft.id,
      state: "completed",
    });
  });
});

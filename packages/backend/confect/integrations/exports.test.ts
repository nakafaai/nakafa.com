import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { XLSX_TYPE } from "@repo/backend/confect/integrations/api";
import {
  encodeCsv,
  encodeXlsx,
} from "@repo/backend/confect/integrations/exports";
import { read, tokenOf } from "@repo/backend/test/api";
import { period } from "@repo/backend/test/classroom";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

describe("encodeCsv", () => {
  it("writes the header and the rows with the line ends of RFC 4180", () => {
    expect(encodeCsv({ header: ["id", "name"], rows: [["1", "Raka"]] })).toBe(
      "id,name\r\n1,Raka"
    );
  });

  it("quotes a field that holds a comma, a quote or a line break", () => {
    expect(
      encodeCsv({ header: ["name"], rows: [['Raka, "R"'], ["a\nb"]] })
    ).toBe('name\r\n"Raka, ""R"""\r\n"a\nb"');
  });

  it("keeps a spreadsheet from reading a name as a formula", () => {
    expect(encodeCsv({ header: ["name"], rows: [["=1+1"], ["@a"]] })).toBe(
      "name\r\n'=1+1\r\n'@a"
    );
  });
});

describe("encodeXlsx", () => {
  it.effect("writes a zip, the container of an XLSX file", () =>
    Effect.gen(function* () {
      const bytes = yield* encodeXlsx({
        header: ["id", "name"],
        rows: [["1", "Raka"]],
      });

      expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
    })
  );
});

describe("school API exports over HTTP", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(TENANCY_NOW);
    vi.stubEnv("SITE_URL", "https://nakafa.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.effect("serves a read as CSV and as XLSX to its bearer", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const token = yield* tokenOf(fixture, ["person.view"]);

      const csv = yield* read(fixture, "/exports/csv/people", token);
      expect(csv.status).toBe(200);
      expect(csv.headers.get("content-type")).toContain("text/csv");
      const text = yield* Effect.promise(() => csv.text());
      expect(text.startsWith("id,name,status,account")).toBe(true);

      const xlsx = yield* read(fixture, "/exports/xlsx/people", token);
      expect(xlsx.status).toBe(200);
      expect(xlsx.headers.get("content-type")).toBe(XLSX_TYPE);
    })
  );

  it.effect(
    "refuses a period's export without its period, and a closed read",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const token = yield* tokenOf(fixture, ["cohort.view"]);

        expect(
          (yield* read(fixture, "/exports/csv/placements", token)).status
        ).toBe(403);
        expect(
          (yield* read(fixture, "/exports/csv/people", token)).status
        ).toBe(403);
      })
  );

  it.effect("exports the placements and the grades of a period", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const term = yield* period(fixture, fixture.units.smp);
      const token = yield* tokenOf(fixture, [
        "cohort.view",
        "grade.export",
        "period.view",
      ]);

      const placements = yield* read(
        fixture,
        `/exports/csv/placements?period=${term.id}`,
        token
      );
      const grades = yield* read(
        fixture,
        `/exports/csv/grades?period=${term.id}`,
        token
      );
      expect(placements.status).toBe(200);
      expect(grades.status).toBe(200);
      expect(yield* Effect.promise(() => grades.text())).toBe(
        "periodId,classId,personId,value,releasedAt"
      );
    })
  );
});

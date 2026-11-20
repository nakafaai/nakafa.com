import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { PAGE_LIMIT, XLSX_TYPE } from "@repo/backend/confect/integrations/api";
import {
  encodeCsv,
  encodeXlsx,
} from "@repo/backend/confect/integrations/exports";
import { createClient, read, tokenOf } from "@repo/backend/test/api";
import { forumClass, nf, period } from "@repo/backend/test/classroom";
import { asStaffSchool } from "@repo/backend/test/guardians";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema, String as Str } from "effect";

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

  it.effect(
    "exports a period's placements and released grades, a row each",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const term = yield* period(fixture, fixture.units.smp);
        const { classId } = yield* forumClass(fixture, term.id, "X-1");
        const { personId } = fixture.people.student;
        const writer = yield* createClient(fixture, ["grade.import"]);
        const entered = yield* fixture.internal.mutation(
          refs.internal.integrations.writes.enterGrade,
          { classId, clientId: writer.id, personId, value: 88 }
        );
        assert(entered.outcome === "entered");
        const gradeId = yield* Schema.decodeUnknownEffect(Id("classGrades"))(
          entered.grade.id
        );
        yield* fixture
          .as("teacher")
          .mutation(refs.public.records.grades.release, { gradeId, slug: nf });
        const token = yield* tokenOf(fixture, [
          "cohort.view",
          "grade.export",
          "period.view",
        ]);
        const csv = (dataset: string) =>
          read(
            fixture,
            `/exports/csv/${dataset}?period=${term.id}`,
            token
          ).pipe(
            Effect.flatMap((answer) => Effect.promise(() => answer.text())),
            Effect.map(Str.split("\r\n"))
          );

        const placements = yield* csv("placements");
        expect(placements).toHaveLength(2);
        expect(placements[1]).toContain(personId);
        const grades = yield* csv("grades");
        expect(grades[0]).toBe("periodId,classId,personId,value,releasedAt");
        expect(grades[1]).toContain(`${classId},${personId},88,`);
      })
  );

  it.effect("reads every page of a read longer than one", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          Effect.forEach(
            Arr.range(1, PAGE_LIMIT),
            (index) =>
              writer.table("tenantPeople").insert({
                account: { state: "unclaimed" },
                kind: "member",
                name: `Siswa ${index}`,
                status: "active",
                tenantId: fixture.tenants.nf,
              }),
            { discard: true }
          ).pipe(Effect.orDie)
        )
      );
      const token = yield* tokenOf(fixture, ["person.view"]);
      const answer = yield* read(fixture, "/exports/csv/people", token);
      const lines = Str.split(
        yield* Effect.promise(() => answer.text()),
        "\r\n"
      );
      // A page holds at most PAGE_LIMIT rows, so more rows than that come from a second page.
      expect(lines.length).toBeGreaterThan(PAGE_LIMIT + 1);
    })
  );
});

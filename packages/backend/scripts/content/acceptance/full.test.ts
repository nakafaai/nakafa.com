import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import type { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import {
  fillAcceptanceSchool,
  fullMode,
} from "@repo/backend/scripts/content/acceptance/full";
import { JsonTextSchema } from "@repo/utilities/json";
import {
  Array as Arr,
  Duration,
  Effect,
  Fiber,
  FileSystem,
  MutableHashMap,
  Option,
  Schema,
  String as Str,
} from "effect";
import { TestClock } from "effect/testing";

const mocks = vi.hoisted(() => ({ command: vi.fn(), read: vi.fn() }));
vi.mock("@repo/backend/scripts/content/acceptance/command", () => ({
  runAcceptanceCommand: mocks.command,
}));
vi.mock(
  "@repo/backend/scripts/content/acceptance/local",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@repo/backend/scripts/content/acceptance/local")
    >()),
    readLocalRuntime: mocks.read,
  })
);

type CommandSpec = Parameters<typeof runAcceptanceCommand>[0];

/** A school of each record's small count, enough to reach each kind of row. */
const COUNT = {
  classes: 6,
  exams: 2,
  guardians: 4,
  invites: 5,
  students: 8,
  teachers: 3,
} as const;

/** One imported row, as its JSON Lines file holds it. */
const StoredRow = Schema.fromJsonString(
  Schema.Record(Schema.String, Schema.Unknown)
);

const OWNER = {
  _id: "owner",
  account: { userId: "user" },
  name: "Acceptance Owner",
  tenantId: "tenant",
};
const SEEDED = {
  tenantUnits: [{ _id: "unit", tenantId: "tenant" }],
  tenants: [{ _id: "tenant", slug: "acc-1" }],
};

/** What the backend holds at the start of a run, and what each table's import appends. */
const stubBackend = (held: {
  readonly tenantPeople: readonly object[];
  readonly tenantUnits: readonly object[];
  readonly tenants: readonly object[];
  readonly failImports?: readonly string[];
  readonly lostWatch?: readonly string[];
  readonly named?: boolean;
}) => {
  const written = MutableHashMap.empty<string, readonly object[]>();
  const printed = (table: string): readonly object[] => [
    ...(table === "tenants" ||
    table === "tenantUnits" ||
    table === "tenantPeople"
      ? held[table]
      : []),
    ...Option.getOrElse(MutableHashMap.get(written, table), () => []),
  ];
  mocks.read.mockReturnValue(Effect.succeed({ backend: "/runtime/backend" }));
  mocks.command.mockImplementation((spec: CommandSpec) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const [, verb, ...rest] = spec.args;
      if (verb === "data") {
        const table = rest[0] ?? "";
        const text = yield* Schema.encodeEffect(JsonTextSchema)(printed(table));
        yield* fs.writeFileString(spec.stdoutPath, text);
        return;
      }
      const table = rest[1] ?? "";
      const text = yield* fs.readFileString(rest[4] ?? "");
      const refused = Arr.contains(held.failImports ?? [], table);
      const rows = Arr.map(Str.split(text, "\n"), (line, index): object => ({
        _id: `${table}-${index}`,
        ...Schema.decodeSync(StoredRow)(line),
      }));
      if (held.named !== false && !refused) {
        MutableHashMap.set(written, table, rows);
      }
      if (refused || Arr.contains(held.lostWatch ?? [], table)) {
        return yield* acceptanceRuntimeError(
          "The watch of the import timed out."
        );
      }
      yield* fs.writeFileString(spec.stdoutPath, "");
    })
  );
  return (table: string) =>
    Option.getOrElse(MutableHashMap.get(written, table), () => []);
};

/** Moves the test clock on until a run that reads files between its pauses ends. */
const passTheClock = <A, E>(run: Fiber.Fiber<A, E>) =>
  TestClock.adjust(Duration.seconds(30)).pipe(
    Effect.andThen(Effect.yieldNow),
    Effect.repeat({ until: () => run.pollUnsafe() !== undefined })
  );

describe("acceptance full school", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.effect(
    "writes every record of the counts, each pointing at the rows written before it",
    () =>
      Effect.gen(function* () {
        const written = stubBackend({ ...SEEDED, tenantPeople: [OWNER] });

        yield* fillAcceptanceSchool("/root", "acc-1", COUNT);

        expect(written("tenantPeople")).toHaveLength(20);
        expect(written("tenantGrants")).toHaveLength(20);
        expect(written("tenantCohorts")).toHaveLength(20);
        expect(written("tenantCohortMembers")).toHaveLength(COUNT.students);
        // Every cohort but the last holds a homeroom teacher, and there are fewer teachers here.
        expect(written("tenantAssignments")).toHaveLength(COUNT.teachers);
        expect(written("classes")).toHaveLength(COUNT.classes);
        expect(written("classroomChannels")).toHaveLength(COUNT.classes);
        expect(written("classTeachers")).toHaveLength(COUNT.classes);
        expect(written("exams")).toHaveLength(COUNT.exams);
        expect(written("exams")[1]).toMatchObject({
          createdBy: "user",
          scope: { kind: "tenant" },
          title: "Biologi PAS X-2 2",
        });
        expect(written("guardianLinks")).toHaveLength(COUNT.guardians);
        expect(written("guardianLinks")[0]).toMatchObject({
          mismatches: 1,
          startedBy: "owner",
          state: { status: "verified" },
        });
        expect(written("guardianLinks")[1]).toMatchObject({
          mismatches: 0,
          state: { status: "pending" },
        });
        expect(written("tenantInvites")).toHaveLength(COUNT.invites);
        expect(written("tenantInvites")[3]).toMatchObject({
          state: { status: "pending" },
        });
        expect(written("tenantInvites")[4]).toMatchObject({
          state: { status: "revoked" },
        });
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("requires a prepared and running local runtime", () =>
    Effect.gen(function* () {
      mocks.read.mockReturnValue(Effect.void);

      const error = yield* fillAcceptanceSchool("/root", "acc-1", COUNT).pipe(
        Effect.flip
      );

      expect(error).toMatchObject({
        message: expect.stringContaining("acceptance:prepare"),
      });
      expect(mocks.command).not.toHaveBeenCalled();
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("refuses a school that no row holds", () =>
    Effect.gen(function* () {
      stubBackend({ ...SEEDED, tenantPeople: [OWNER], tenants: [] });

      const error = yield* fillAcceptanceSchool("/root", "acc-1", COUNT).pipe(
        Effect.flip
      );

      expect(error).toMatchObject({ message: "No school holds acc-1." });
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("refuses a school without a unit", () =>
    Effect.gen(function* () {
      stubBackend({ ...SEEDED, tenantPeople: [OWNER], tenantUnits: [] });

      const error = yield* fillAcceptanceSchool("/root", "acc-1", COUNT).pipe(
        Effect.flip
      );

      expect(error).toMatchObject({ message: "acc-1 holds no unit." });
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("refuses a school whose Owner has not signed in", () =>
    Effect.gen(function* () {
      stubBackend({
        ...SEEDED,
        tenantPeople: [{ ...OWNER, account: {} }],
      });

      const error = yield* fillAcceptanceSchool("/root", "acc-1", COUNT).pipe(
        Effect.flip
      );

      expect(error).toMatchObject({
        message: "Sign the Owner of acc-1 in before filling the school.",
      });
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("stops when an import left no row for a name it wrote", () =>
    Effect.gen(function* () {
      stubBackend({ ...SEEDED, named: false, tenantPeople: [OWNER] });

      const error = yield* fillAcceptanceSchool("/root", "acc-1", COUNT).pipe(
        Effect.flip
      );

      expect(error).toMatchObject({
        message: "No row holds the name Ganjil 2026/2027.",
      });
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("goes on when only the watch of an import timed out", () =>
    Effect.gen(function* () {
      const written = stubBackend({
        ...SEEDED,
        lostWatch: ["exams"],
        tenantPeople: [OWNER],
      });

      const run = yield* fillAcceptanceSchool("/root", "acc-1", COUNT).pipe(
        Effect.forkChild
      );
      yield* passTheClock(run);
      yield* Fiber.join(run);

      expect(written("exams")).toHaveLength(COUNT.exams);
      expect(written("tenantInvites")).toHaveLength(COUNT.invites);
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("refuses an import that left no rows", () =>
    Effect.gen(function* () {
      stubBackend({
        ...SEEDED,
        failImports: ["exams"],
        tenantPeople: [OWNER],
      });

      const run = yield* fillAcceptanceSchool("/root", "acc-1", COUNT).pipe(
        Effect.flip,
        Effect.forkChild
      );
      yield* passTheClock(run);

      expect(yield* Fiber.join(run)).toMatchObject({
        message: "The import of exams failed.",
      });
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("leaves a table alone that already holds its rows", () =>
    Effect.gen(function* () {
      const written = stubBackend({ ...SEEDED, tenantPeople: [OWNER] });

      yield* fillAcceptanceSchool("/root", "acc-1", COUNT);
      const exams = written("exams");
      yield* fillAcceptanceSchool("/root", "acc-1", COUNT);

      // A second import would have replaced the stub's rows with new objects.
      expect(written("exams")).toBe(exams);
    }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("fills the school that the full mode names", () =>
    Effect.gen(function* () {
      const written = stubBackend({ ...SEEDED, tenantPeople: [OWNER] });

      yield* fullMode.run("/root", ["acc-1"]);

      expect(written("tenantPeople")).toHaveLength(2000);
      expect(written("classes")).toHaveLength(100);
    }).pipe(Effect.provide(nodeServicesLayer))
  );
});

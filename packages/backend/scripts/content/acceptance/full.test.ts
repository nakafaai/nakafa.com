import { afterEach, describe, expect, it } from "@effect/vitest";
import { LocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import {
  fillSchool,
  fullMode,
} from "@repo/backend/scripts/content/acceptance/full";
import { nodePlatform } from "@repo/backend/test/platform";
import {
  Array as Arr,
  Duration,
  Effect,
  Fiber,
  Layer,
  MutableHashMap,
  Option,
  Schema,
} from "effect";
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

/** A school of each record's small count, enough to reach each kind of row. */
const COUNT = {
  classes: 6,
  exams: 2,
  guardians: 4,
  invites: 5,
  students: 8,
  teachers: 3,
} as const;

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

/** The table a read of `_system/cli/tableData` names. */
const TableRead = Schema.Struct({ table: Schema.String });

/**
 * A local backend that holds `held` at the start of a run and keeps what each
 * import appends. An import of a table in `failImports` writes nothing and
 * fails; one in `lostWatch` writes its rows and still fails, as a read of its
 * state that a busy backend refused. With `named` false an import writes none
 * of the rows a later read could name.
 */
const stubBackend = (held: {
  readonly tenantPeople: readonly object[];
  readonly tenantUnits: readonly object[];
  readonly tenants: readonly object[];
  readonly failImports?: readonly string[];
  readonly lostWatch?: readonly string[];
  readonly named?: boolean;
}) => {
  const written = MutableHashMap.empty<string, readonly object[]>();
  const rowsOf = (table: string): readonly object[] => [
    ...(table === "tenants" ||
    table === "tenantUnits" ||
    table === "tenantPeople"
      ? held[table]
      : []),
    ...Option.getOrElse(MutableHashMap.get(written, table), () => []),
  ];
  const convex = LocalConvex.of({
    importRows: (table, rows) =>
      Effect.suspend(() => {
        const refused = Arr.contains(held.failImports ?? [], table);
        if (held.named !== false && !refused) {
          MutableHashMap.set(
            written,
            table,
            Arr.map(rows, (row, index): object => ({
              _id: `${table}-${index}`,
              ...Schema.decodeUnknownSync(
                Schema.Record(Schema.String, Schema.Unknown)
              )(row),
            }))
          );
        }
        return refused || Arr.contains(held.lostWatch ?? [], table)
          ? Effect.fail(acceptanceRuntimeError("The import state read failed."))
          : Effect.void;
      }),
    run: (_operation, call) =>
      Effect.map(
        Schema.decodeUnknownEffect(TableRead)(call.args),
        ({ table }) => ({
          continueCursor: "",
          isDone: true,
          page: rowsOf(table),
        })
      ).pipe(Effect.orDie),
  });
  return {
    layer: Layer.succeed(LocalConvex, convex),
    written: (table: string) =>
      Option.getOrElse(MutableHashMap.get(written, table), () => []),
  };
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
        const backend = stubBackend({ ...SEEDED, tenantPeople: [OWNER] });

        yield* fillSchool("acc-1", COUNT).pipe(Effect.provide(backend.layer));

        expect(backend.written("tenantPeople")).toHaveLength(20);
        expect(backend.written("tenantGrants")).toHaveLength(20);
        expect(backend.written("tenantCohorts")).toHaveLength(20);
        expect(backend.written("tenantCohortMembers")).toHaveLength(
          COUNT.students
        );
        // Every cohort but the last holds a homeroom teacher, and there are fewer teachers here.
        expect(backend.written("tenantAssignments")).toHaveLength(
          COUNT.teachers
        );
        expect(backend.written("classes")).toHaveLength(COUNT.classes);
        expect(backend.written("classroomChannels")).toHaveLength(
          COUNT.classes
        );
        expect(backend.written("classTeachers")).toHaveLength(COUNT.classes);
        expect(backend.written("exams")).toHaveLength(COUNT.exams);
        expect(backend.written("exams")[1]).toMatchObject({
          createdBy: "user",
          scope: { kind: "tenant" },
          title: "Biologi PAS X-2 2",
        });
        expect(backend.written("guardianLinks")).toHaveLength(COUNT.guardians);
        expect(backend.written("guardianLinks")[0]).toMatchObject({
          mismatches: 1,
          startedBy: "owner",
          state: { status: "verified" },
        });
        expect(backend.written("guardianLinks")[1]).toMatchObject({
          mismatches: 0,
          state: { status: "pending" },
        });
        expect(backend.written("tenantInvites")).toHaveLength(COUNT.invites);
        expect(backend.written("tenantInvites")[3]).toMatchObject({
          state: { status: "pending" },
        });
        expect(backend.written("tenantInvites")[4]).toMatchObject({
          state: { status: "revoked" },
        });
      }).pipe(Effect.provide(nodePlatform))
  );

  it.effect("refuses a school that no row holds", () =>
    Effect.gen(function* () {
      const backend = stubBackend({
        ...SEEDED,
        tenantPeople: [OWNER],
        tenants: [],
      });

      const error = yield* fillSchool("acc-1", COUNT).pipe(
        Effect.provide(backend.layer),
        Effect.flip
      );

      expect(error).toMatchObject({ message: "No school holds acc-1." });
    }).pipe(Effect.provide(nodePlatform))
  );

  it.effect("refuses a school without a unit", () =>
    Effect.gen(function* () {
      const backend = stubBackend({
        ...SEEDED,
        tenantPeople: [OWNER],
        tenantUnits: [],
      });

      const error = yield* fillSchool("acc-1", COUNT).pipe(
        Effect.provide(backend.layer),
        Effect.flip
      );

      expect(error).toMatchObject({ message: "acc-1 holds no unit." });
    }).pipe(Effect.provide(nodePlatform))
  );

  it.effect("refuses a school whose Owner has not signed in", () =>
    Effect.gen(function* () {
      const backend = stubBackend({
        ...SEEDED,
        tenantPeople: [{ ...OWNER, account: {} }],
      });

      const error = yield* fillSchool("acc-1", COUNT).pipe(
        Effect.provide(backend.layer),
        Effect.flip
      );

      expect(error).toMatchObject({
        message: "Sign the Owner of acc-1 in before filling the school.",
      });
    }).pipe(Effect.provide(nodePlatform))
  );

  it.effect("stops when an import left no row for a name it wrote", () =>
    Effect.gen(function* () {
      const backend = stubBackend({
        ...SEEDED,
        named: false,
        tenantPeople: [OWNER],
      });

      const error = yield* fillSchool("acc-1", COUNT).pipe(
        Effect.provide(backend.layer),
        Effect.flip
      );

      expect(error).toMatchObject({
        message: "No row holds the name Ganjil 2026/2027.",
      });
    }).pipe(Effect.provide(nodePlatform))
  );

  it.effect("goes on when only the watch of an import timed out", () =>
    Effect.gen(function* () {
      const backend = stubBackend({
        ...SEEDED,
        lostWatch: ["exams"],
        tenantPeople: [OWNER],
      });

      const run = yield* fillSchool("acc-1", COUNT).pipe(
        Effect.provide(backend.layer),
        Effect.forkChild
      );
      yield* passTheClock(run);
      yield* Fiber.join(run);

      expect(backend.written("exams")).toHaveLength(COUNT.exams);
      expect(backend.written("tenantInvites")).toHaveLength(COUNT.invites);
    }).pipe(Effect.provide(nodePlatform))
  );

  it.effect("refuses an import that left no rows", () =>
    Effect.gen(function* () {
      const backend = stubBackend({
        ...SEEDED,
        failImports: ["exams"],
        tenantPeople: [OWNER],
      });

      const run = yield* fillSchool("acc-1", COUNT).pipe(
        Effect.provide(backend.layer),
        Effect.flip,
        Effect.forkChild
      );
      yield* passTheClock(run);

      expect(yield* Fiber.join(run)).toMatchObject({
        message: "The import of exams failed.",
      });
    }).pipe(Effect.provide(nodePlatform))
  );

  it.effect("leaves a table alone that already holds its rows", () =>
    Effect.gen(function* () {
      const backend = stubBackend({ ...SEEDED, tenantPeople: [OWNER] });

      yield* fillSchool("acc-1", COUNT).pipe(Effect.provide(backend.layer));
      const exams = backend.written("exams");
      yield* fillSchool("acc-1", COUNT).pipe(Effect.provide(backend.layer));

      // A second import would have replaced the stub's rows with new objects.
      expect(backend.written("exams")).toBe(exams);
    }).pipe(Effect.provide(nodePlatform))
  );

  it.effect("fills the school that the full mode names", () =>
    Effect.gen(function* () {
      const backend = stubBackend({ ...SEEDED, tenantPeople: [OWNER] });
      mocks.layer.mockReturnValue(backend.layer);

      yield* fullMode.run("/root", ["acc-1"]);

      expect(backend.written("tenantPeople")).toHaveLength(2000);
      expect(backend.written("classes")).toHaveLength(100);
    }).pipe(Effect.provide(nodePlatform))
  );
});

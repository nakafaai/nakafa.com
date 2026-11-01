import {
  classNameKey,
  classNameOf,
  classSlugOf,
  classSubjectKey,
} from "@repo/backend/confect/classroom/class";
import { GENERAL_CHANNEL_NAME } from "@repo/backend/confect/classroom/forum/channel";
import { cohortNameKey } from "@repo/backend/confect/tenancy/cohort";
import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import {
  type LocalRuntime,
  readLocalRuntime,
} from "@repo/backend/scripts/content/acceptance/local";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import {
  COHORT_COUNT,
  cohortOf,
  FULL_SCHOOL,
  peopleOf,
  personName,
  type SchoolCounts,
  SUBJECTS,
} from "@repo/backend/scripts/content/acceptance/roll";
import { JsonTextSchema } from "@repo/utilities/json";
import {
  Array as Arr,
  Clock,
  Duration,
  Effect,
  FileSystem,
  HashMap,
  Option,
  Schedule,
  Schema,
  String as Str,
} from "effect";

/** The moments a full school's rows take relative to the moment it is seeded. */
const INVITE_TERM = Duration.toMillis(Duration.days(14));
const DAY = Duration.toMillis(Duration.days(1));

/** The active period of a full school, and the planned one after it. */
const ACTIVE_PERIOD = {
  end: "2026-12-19",
  name: "Ganjil 2026/2027",
  start: "2026-07-13",
  status: "active",
};
const PLANNED_PERIOD = {
  end: "2027-06-19",
  name: "Genap 2026/2027",
  start: "2027-01-04",
  status: "planned",
};

/** The rows of a table, newest first, up to the school's size and every other school a shared runtime holds. */
const READ_LIMIT = "20000";

/** A read of a whole table can time out on a busy local backend, so a failed one runs again. */
const READ_RETRIES = 4;
const READ_PAUSE = Duration.seconds(15);

const encodeRow = Schema.encodeEffect(JsonTextSchema);

/** The rows of the tables that the seed reads back, as much of each as it needs. */
const TenantRows = Schema.fromJsonString(
  Schema.Array(Schema.Struct({ _id: Schema.String, slug: Schema.String }))
);
const UnitRows = Schema.fromJsonString(
  Schema.Array(Schema.Struct({ _id: Schema.String, tenantId: Schema.String }))
);
const NamedRows = Schema.fromJsonString(
  Schema.Array(
    Schema.Struct({
      _id: Schema.String,
      name: Schema.String,
      tenantId: Schema.String,
    })
  )
);
const PeopleRows = Schema.fromJsonString(
  Schema.Array(
    Schema.Struct({
      _id: Schema.String,
      account: Schema.Struct({ userId: Schema.optionalKey(Schema.String) }),
      tenantId: Schema.String,
    })
  )
);

const TenantOwnedRows = Schema.fromJsonString(
  Schema.Array(Schema.Struct({ tenantId: Schema.String }))
);

/** A row the next tables point at by its name. */
const NamedRow = Schema.Struct({ name: Schema.String });

/** One table's newest rows, decoded by `rows`. */
const readRows = <Rows>(
  runtime: LocalRuntime,
  table: string,
  rows: Schema.Codec<Rows, string>
) =>
  runLocalConvex(runtime, `${table} rows`, [
    "data",
    table,
    "--format",
    "jsonArray",
    "--limit",
    READ_LIMIT,
  ]).pipe(
    // The CLI prints nothing for a table that holds no row.
    Effect.map((printed) => (Str.isEmpty(printed) ? "[]" : printed)),
    Effect.flatMap(Schema.decodeEffect(rows)),
    Effect.retry({ schedule: Schedule.spaced(READ_PAUSE), times: READ_RETRIES })
  );

/** The school of a slug: its ID, its first unit, and its Owner, who must have signed in. */
const schoolOf = Effect.fn("contentAcceptance.full.school")(function* (
  runtime: LocalRuntime,
  slug: string
) {
  const tenant = Arr.findFirst(
    yield* readRows(runtime, "tenants", TenantRows),
    (row) => row.slug === slug
  );
  if (Option.isNone(tenant)) {
    return yield* acceptanceRuntimeError(`No school holds ${slug}.`);
  }
  const tenantId = tenant.value._id;
  const unit = Arr.findFirst(
    yield* readRows(runtime, "tenantUnits", UnitRows),
    (row) => row.tenantId === tenantId
  );
  if (Option.isNone(unit)) {
    return yield* acceptanceRuntimeError(`${slug} holds no unit.`);
  }
  const owner = Arr.findFirst(
    yield* readRows(runtime, "tenantPeople", PeopleRows),
    (row) => row.tenantId === tenantId && row.account.userId !== undefined
  );
  if (Option.isNone(owner) || owner.value.account.userId === undefined) {
    return yield* acceptanceRuntimeError(
      `Sign the Owner of ${slug} in before filling the school.`
    );
  }
  return {
    createdBy: owner.value.account.userId,
    startedBy: owner.value._id,
    tenantId,
    unitId: unit.value._id,
  };
});

/**
 * Writes one table's rows and then reads back the IDs of the school's rows of the table by
 * their names, which is how the next tables point at them. A name the seed wrote always has
 * a row, so a missing one is a failed import. A table that already holds its rows is left
 * alone, so a run that a busy backend stopped starts again where it stopped.
 */
const makeWriter = (
  runtime: LocalRuntime,
  tenantId: string,
  directory: string
) => {
  const heldRows = Effect.fn("contentAcceptance.full.held")(function* (
    table: string
  ) {
    const stored = yield* readRows(runtime, table, TenantOwnedRows);
    return Arr.filter(stored, (row) => row.tenantId === tenantId).length;
  });
  const importRows = Effect.fn("contentAcceptance.full.import")(function* (
    table: string,
    file: string,
    expected: number
  ) {
    const imported = yield* runLocalConvex(runtime, `${table} import`, [
      "import",
      "--table",
      table,
      "--append",
      "--yes",
      file,
    ]).pipe(
      Effect.as(true),
      Effect.orElseSucceed(() => false)
    );
    if (imported) {
      return;
    }
    // A busy backend can time out the CLI's watch of an import that runs on regardless.
    yield* Effect.sleep(READ_PAUSE);
    if ((yield* heldRows(table)) < expected) {
      return yield* acceptanceRuntimeError(`The import of ${table} failed.`);
    }
  });
  const write = Effect.fn("contentAcceptance.full.write")(function* (
    table: string,
    rows: readonly object[]
  ) {
    if ((yield* heldRows(table)) >= rows.length) {
      return;
    }
    const fs = yield* FileSystem.FileSystem;
    const lines = yield* Effect.forEach(rows, (row) => encodeRow(row));
    const file = `${directory}/${table}.jsonl`;
    yield* fs.writeFileString(file, Arr.join(lines, "\n"));
    yield* importRows(table, file, rows.length);
  });
  const writeNamed = Effect.fn("contentAcceptance.full.named")(function* (
    table: string,
    rows: readonly (typeof NamedRow.Type)[]
  ) {
    yield* write(table, rows);
    const stored = yield* readRows(runtime, table, NamedRows);
    const ids = HashMap.fromIterable(
      Arr.map(
        Arr.filter(stored, (row) => row.tenantId === tenantId),
        (row): readonly [string, string] => [row.name, row._id]
      )
    );
    return Effect.fn("contentAcceptance.full.id")(function* (name: string) {
      const id = HashMap.get(ids, name);
      if (Option.isNone(id)) {
        return yield* acceptanceRuntimeError(`No row holds the name ${name}.`);
      }
      return id.value;
    });
  });
  return { write, writeNamed };
};

/**
 * Fills an opened school in the running local acceptance backend with the records of a real
 * one, the counts of `FULL_SCHOOL`. Rows go straight into their tables through `convex import`,
 * as the `import` mode appends rows no app function creates cheaply: creating these one by one
 * would run for hours. Only `XII-6` has no homeroom teacher, so a walk can assign one. The
 * school's Owner must have signed in, because a guardian link and an exam name who started them.
 */
export const fillAcceptanceSchool = Effect.fn("contentAcceptance.fullSchool")(
  function* (root: string, slug: string, count: typeof SchoolCounts.Type) {
    const runtime = yield* readLocalRuntime(root);
    if (runtime === undefined) {
      return yield* acceptanceRuntimeError(
        "Run bun run acceptance:prepare and start acceptance before filling a school."
      );
    }
    const school = yield* schoolOf(runtime, slug);
    const { createdBy, startedBy, tenantId, unitId } = school;
    const fs = yield* FileSystem.FileSystem;
    const directory = yield* fs.makeTempDirectoryScoped({
      prefix: "acceptance-full-",
    });
    const { write, writeNamed } = makeWriter(runtime, tenantId, directory);
    const now = yield* Clock.currentTimeMillis;
    const people = peopleOf(count);
    const unitScope = { kind: "unit", unitId };
    const schoolScope = { kind: "tenant" };

    const periodOf = yield* writeNamed(
      "tenantPeriods",
      Arr.map([PLANNED_PERIOD, ACTIVE_PERIOD], (period) => ({
        ...period,
        tenantId,
        unitId,
      }))
    );
    const periodId = yield* periodOf(ACTIVE_PERIOD.name);

    const personOf = yield* writeNamed(
      "tenantPeople",
      Arr.makeBy(
        count.students + count.teachers + count.guardians + count.invites,
        (index) => ({
          account: { state: "unclaimed" },
          kind: "member",
          name: personName(index),
          status: "active",
          tenantId,
        })
      )
    );
    const personId = (index: number) => personOf(personName(index));
    const grants = (indexes: readonly number[], key: string, scope: object) =>
      Effect.forEach(indexes, (index) =>
        Effect.map(personId(index), (id) => ({
          grantedBy: { kind: "system" },
          personId: id,
          role: { key, kind: "builtin" },
          scope,
          status: "active",
          tenantId,
          term: { kind: "standing" },
        }))
      );
    yield* write(
      "tenantGrants",
      Arr.flatten([
        yield* grants(people.students, "student", unitScope),
        yield* grants(people.teachers, "teacher", schoolScope),
        yield* grants(people.guardians, "guardian", schoolScope),
        yield* grants(people.invited, "teacher", schoolScope),
      ])
    );

    const cohorts = Arr.makeBy(COHORT_COUNT, cohortOf);
    const cohortOfName = yield* writeNamed(
      "tenantCohorts",
      Arr.map(cohorts, (cohort) => ({
        ...cohort,
        nameKey: cohortNameKey(cohort.name),
        periodId,
        status: "active",
        tenantId,
        unitId,
      }))
    );
    const cohortId = (index: number) => cohortOfName(cohortOf(index).name);
    yield* write(
      "tenantCohortMembers",
      yield* Effect.forEach(people.students, (student) =>
        Effect.all({
          cohortId: cohortId(student % COHORT_COUNT),
          periodId: Effect.succeed(periodId),
          personId: personId(student),
          tenantId: Effect.succeed(tenantId),
        })
      )
    );
    yield* write(
      "tenantAssignments",
      yield* Effect.forEach(
        Arr.take(people.teachers, COHORT_COUNT - 1),
        (teacher, index) =>
          Effect.all({
            cohortId: cohortId(index),
            kind: Effect.succeed("homeroom"),
            periodId: Effect.succeed(periodId),
            personId: personId(teacher),
            tenantId: Effect.succeed(tenantId),
          })
      )
    );

    const classes = Arr.makeBy(count.classes, (index) => {
      const subject = Arr.getUnsafe(
        SUBJECTS,
        Math.floor(index / COHORT_COUNT) % SUBJECTS.length
      );
      const cohort = index % COHORT_COUNT;
      return {
        cohort,
        name: classNameOf(cohortOf(cohort).name, subject),
        subject,
      };
    });
    const classOf = yield* writeNamed(
      "classes",
      yield* Effect.forEach(classes, ({ cohort, name, subject }) =>
        Effect.map(cohortId(cohort), (id) => ({
          cohortId: id,
          createdAt: now,
          name,
          nameKey: classNameKey(name),
          periodId,
          slug: classSlugOf(name),
          status: "active",
          subject,
          subjectKey: classSubjectKey(subject),
          tenantId,
          unitId,
          updatedAt: now,
        }))
      )
    );
    yield* write(
      "classroomChannels",
      yield* Effect.forEach(classes, ({ name }) =>
        Effect.map(classOf(name), (classId) => ({
          classId,
          createdAt: now,
          kind: "general",
          name: GENERAL_CHANNEL_NAME,
          position: 0,
          tenantId,
        }))
      )
    );
    yield* write(
      "classTeachers",
      yield* Effect.forEach(classes, ({ name }, index) =>
        Effect.all({
          classId: classOf(name),
          createdAt: Effect.succeed(now),
          periodId: Effect.succeed(periodId),
          personId: personId(count.students + (index % count.teachers)),
          tenantId: Effect.succeed(tenantId),
        })
      )
    );

    yield* write(
      "exams",
      Arr.makeBy(count.exams, (index) => ({
        createdAt: now - index * DAY,
        createdBy,
        questions: [],
        scope: schoolScope,
        tenantId,
        title: `${Arr.getUnsafe(SUBJECTS, index % SUBJECTS.length)} ${
          index % 2 === 0 ? "PTS" : "PAS"
        } ${cohortOf(index % COHORT_COUNT).name} ${index + 1}`,
      }))
    );

    yield* write(
      "guardianLinks",
      yield* Effect.forEach(people.guardians, (guardian, index) =>
        Effect.all({
          email: Effect.succeed(`wali-${index + 1}@acceptance.example.test`),
          expiresAt: Effect.succeed(now + INVITE_TERM - index * DAY),
          guardianPersonId: personId(guardian),
          mismatches: Effect.succeed(index % 7 === 0 ? 1 : 0),
          startedBy: Effect.succeed(startedBy),
          state: Effect.succeed(
            index % 3 === 0
              ? { at: now - index * DAY, status: "verified" }
              : { status: "pending" }
          ),
          studentPersonId: personId(index),
          tenantId: Effect.succeed(tenantId),
        })
      )
    );

    yield* write(
      "tenantInvites",
      yield* Effect.forEach(people.invited, (invited, index) =>
        Effect.map(personId(invited), (id) => ({
          channel: {
            email: `guru-${index + 1}@acceptance.example.test`,
            kind: "email",
          },
          expiresAt: now + INVITE_TERM - index * DAY,
          personId: id,
          state:
            index % 5 === 4
              ? { at: now - index * DAY, status: "revoked" }
              : { status: "pending" },
          tenantId,
        }))
      )
    );
  },
  Effect.scoped
);

/** The usage of the full mode: the school to fill. */
const USAGE = "full <school-slug>";
const FullArguments = Schema.Tuple([Schema.String]);

/** The full mode of the acceptance command line: fills the school that the command names. */
export const fullMode = {
  mode: "full",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runFull")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [slug] = yield* decodeModeArguments(USAGE, FullArguments, args);
    return yield* fillAcceptanceSchool(root, slug, FULL_SCHOOL);
  }),
} satisfies AcceptanceMode;

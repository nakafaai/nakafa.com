import type {
  ClassesDoc,
  TenantPeopleDoc,
  TenantsDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { activeGrants } from "@repo/backend/confect/access/policy";
import { classAuthority } from "@repo/backend/confect/classroom/authority";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Array as Arr, Effect, Option } from "effect";

/** The most Persons one read of a class roster holds: its students and its subject teachers. */
const ROSTER_LIMIT = 300;

/** The principal of one Person of a school, as the member middleware builds it, so an access check decides for that Person. */
export const principalOf = Effect.fn("classroom.roster.principal")(function* (
  person: TenantPeopleDoc,
  tenant: TenantsDoc
) {
  return { grants: yield* activeGrants(person._id), person, tenant };
});

/** Whether one Person may take a class action now, decided as the access check decides it for that Person. */
export const mayIn = (
  action: Parameters<typeof classAuthority.check>[0],
  row: ClassesDoc,
  principal: Member["Service"]
) =>
  classAuthority.check(action, row).pipe(
    Effect.provideService(Member, principal),
    Effect.as(true),
    Effect.catchTag("AccessDenied", () => Effect.succeed(false))
  );

/**
 * The Persons who write in a class's forum now: the students placed in its
 * cohort and its subject teachers, active, each once, and each still holding the
 * grant the relation needs. At most ROSTER_LIMIT of each are read.
 */
export const classRoster = Effect.fn("classroom.roster.read")(function* (
  row: ClassesDoc
) {
  const reader = yield* DatabaseReader;
  const placed = yield* reader
    .table("tenantCohortMembers")
    .index("by_cohortId_and_personId", (query) =>
      query.eq("cohortId", row.cohortId)
    )
    .take(ROSTER_LIMIT)
    .pipe(Effect.orDie);
  const teaching = yield* reader
    .table("classTeachers")
    .index("by_classId_and_personId", (query) => query.eq("classId", row._id))
    .take(ROSTER_LIMIT)
    .pipe(Effect.orDie);
  const tenant = yield* reader
    .table("tenants")
    .get(row.tenantId)
    .pipe(Effect.orDie);
  const people = yield* Effect.forEach(
    Arr.dedupe(
      Arr.appendAll(
        Arr.map(placed, (member) => member.personId),
        Arr.map(teaching, (teacher) => teacher.personId)
      )
    ),
    (personId) =>
      Effect.gen(function* () {
        const person = yield* reader
          .table("tenantPeople")
          .get(personId)
          .pipe(Effect.orDie);
        if (person.status !== "active") {
          return Option.none();
        }
        const principal = yield* principalOf(person, tenant);
        return (yield* mayIn("forum.post", row, principal))
          ? Option.some(person)
          : Option.none();
      })
  );
  return Arr.getSomes(people);
});

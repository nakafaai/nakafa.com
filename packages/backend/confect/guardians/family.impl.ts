import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { GuardianLink } from "@repo/backend/confect/guardians/access";
import {
  guardianLinkAccess,
  guardianLinkAuthority,
} from "@repo/backend/confect/guardians/authority";
import spec from "@repo/backend/confect/guardians/family.spec";
import {
  childViewOf,
  countMismatch,
  endLink,
  grantConsent,
  isLive,
  linksOfGuardian,
} from "@repo/backend/confect/guardians/link";
import {
  type ChildGrade,
  NISN_TRIES,
} from "@repo/backend/confect/guardians/schema";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { gradeView } from "@repo/backend/confect/records/grade";
import { schemeOf } from "@repo/backend/confect/records/version";
import { blindNisn, rosterEntryOf } from "@repo/backend/confect/roster/entry";
import { Nisn } from "@repo/backend/confect/roster/schema";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  Array as Arr,
  Clock,
  Effect,
  Layer,
  Option,
  Schema,
  String as Str,
} from "effect";

/** The most released grades of one child a read returns: a child's grades of a few years. */
const GRADE_LIMIT = 200;

/**
 * The children whose links name the caller, each as the guardian sees it. A link
 * the guardian may not view is left out, and an ended link stays in the list so a
 * withdrawal reads as done.
 */
const children = FunctionImpl.make(
  databaseSchema,
  spec,
  "children",
  Effect.fn("guardians.family.children")(function* () {
    const { person } = yield* Member;
    const links = yield* linksOfGuardian(person._id);
    const visible = yield* Effect.filter(links, (link) =>
      guardianLinkAuthority
        .allowed(link)
        .pipe(Effect.map((actions) => Arr.contains(actions, "guardian.view")))
    );
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.forEach(visible, (link) => childViewOf(link, now));
  })
);

/**
 * The guardian's second check: the child's NISN, compared with the roster through
 * its blind under the school key, so no plain NISN is read (ADR 0034). A match
 * grants consent with the method `code_nisn`. A mismatch, a roster without a NISN,
 * a closed link, and a link past its checks all read as `refused`, the words of a
 * wrong code, and only a mismatch is counted for staff to see.
 */
const confirm = FunctionImpl.make(
  databaseSchema,
  spec,
  "confirm",
  Effect.fn("guardians.family.confirm")(function* ({ nisn }) {
    const { person: guardian } = yield* Member;
    const link = yield* GuardianLink;
    const now = yield* Clock.currentTimeMillis;
    if (link.state.status === "verified") {
      return "verified";
    }
    const typed = Schema.decodeOption(Nisn)(Str.trim(nisn));
    const entry = Option.flatMap(yield* rosterEntryOf(link.studentPersonId), (row) =>
      Option.fromUndefinedOr(row.nisn)
    );
    if (
      !isLive(link, now) ||
      link.mismatches >= NISN_TRIES ||
      Option.isNone(entry)
    ) {
      return "refused";
    }
    const blind = yield* Option.match(typed, {
      onNone: () => Effect.succeedNone,
      onSome: (value) => Effect.asSome(blindNisn(link.tenantId, value)),
    });
    if (!Option.contains(blind, entry.value.blind)) {
      yield* countMismatch(link);
      return "refused";
    }
    yield* grantConsent(link, "code_nisn", guardian, personActor(guardian));
    return "verified";
  })
);

/**
 * The guardian withdraws consent. It applies at once: the `withdrawn` ledger row,
 * the end of the relation, and `guardian.withdrawn`, in one transaction. A pending
 * link ends without a ledger row, because no consent stood.
 */
const withdraw = FunctionImpl.make(
  databaseSchema,
  spec,
  "withdraw",
  Effect.fn("guardians.family.withdraw")(function* () {
    const { person: guardian } = yield* Member;
    const link = yield* GuardianLink;
    const now = yield* Clock.currentTimeMillis;
    const ended =
      link.state.status === "ended"
        ? link
        : yield* endLink(link, "withdrawn", personActor(guardian), guardian);
    return yield* childViewOf(ended, now);
  })
);

/**
 * The child's released grades, which a verified link opens (ADR 0012, ADR 0034).
 * Drafts never leave the server, and each grade is judged by the scheme its entry
 * named.
 */
const grades = FunctionImpl.make(
  databaseSchema,
  spec,
  "grades",
  Effect.fn("guardians.family.grades")(function* () {
    const link = yield* GuardianLink;
    const reader = yield* DatabaseReader;
    const rows = yield* reader
      .table("classGrades")
      .index("by_personId_and_periodId", (query) =>
        query.eq("personId", link.studentPersonId)
      )
      .take(GRADE_LIMIT)
      .pipe(Effect.orDie);
    const released = Arr.filter(rows, (row) => row.state === "released");
    return yield* Effect.forEach(released, (row) =>
      Effect.gen(function* () {
        const cls = yield* reader.table("classes").get(row.classId).pipe(Effect.orDie);
        const view = gradeView(row, yield* schemeOf(row.schemeId));
        const grade: typeof ChildGrade.Type = {
          ...(view.band === undefined ? {} : { band: view.band }),
          className: cls.name,
          id: view.id,
          kktp: view.kktp,
          value: view.value,
        };
        return grade;
      })
    );
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(children),
  Layer.provide(confirm),
  Layer.provide(withdraw),
  Layer.provide(grades),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(guardianLinkAccess),
  GroupImpl.finalize
);

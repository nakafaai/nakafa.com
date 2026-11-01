import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import { activeGrants } from "@repo/backend/confect/access/policy";
import { GuardianLink } from "@repo/backend/confect/guardians/access";
import {
  guardianLinkAccess,
  guardianLinkAuthority,
} from "@repo/backend/confect/guardians/authority";
import {
  LinkClosed,
  LinkRefused,
} from "@repo/backend/confect/guardians/errors";
import {
  endLink,
  grantConsent,
  isLive,
  linksOfAddress,
  linkViewOf,
} from "@repo/backend/confect/guardians/link";
import spec from "@repo/backend/confect/guardians/links.spec";
import { readdressLink } from "@repo/backend/confect/guardians/readdress";
import {
  LINK_TERM,
  STUDENT_LINK_LIMIT,
} from "@repo/backend/confect/guardians/schema";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Person } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { personAccess } from "@repo/backend/confect/tenancy/authority";
import { createPerson } from "@repo/backend/confect/tenancy/create";
import {
  Array as Arr,
  Clock,
  Duration,
  Effect,
  Layer,
  Number as Num,
  Option,
  Struct,
} from "effect";

/** The most links one page reads. A request asks for at least one. */
const PAGE_LIMIT = 100;

/** The most links of one student a read keeps: the live ones, and the ended ones of a family that changed. */
const STUDENT_LINK_READ = 20;

/** The links of one student, newest first, live and ended. */
const linksOfStudent = Effect.fn("guardians.links.ofStudent")(function* (
  studentId: GenericId.GenericId<"tenantPeople">
) {
  return yield* (yield* DatabaseReader)
    .table("guardianLinks")
    .index(
      "by_studentPersonId_and_state_status",
      (query) => query.eq("studentPersonId", studentId),
      "desc"
    )
    .take(STUDENT_LINK_READ)
    .pipe(Effect.orDie);
});

/**
 * Starts a link between a student and a guardian's address. The student must be an
 * active student of the school, and an address holds one live link to a student.
 * The guardian Person of an address that already guards a child of the school is
 * reused, so a parent of two children is one Person. Nothing is sent: the guardian
 * asks for a code at `/parents`, and only an address with a link gets one.
 */
const start = FunctionImpl.make(
  databaseSchema,
  spec,
  "start",
  Effect.fn("guardians.links.start")(function* ({ email, guardianName }) {
    const { person: actor } = yield* Member;
    const student = yield* Person;
    const grants = yield* activeGrants(student._id);
    if (
      student.status !== "active" ||
      !Arr.some(grants, (grant) => grant.role.key === "student")
    ) {
      return yield* new LinkRefused({
        code: "NOT_STUDENT",
        message: "Only an active student of the school takes a guardian.",
      });
    }
    const now = yield* Clock.currentTimeMillis;
    const links = yield* linksOfAddress(student.tenantId, email);
    if (
      Arr.some(
        links,
        (link) => link.studentPersonId === student._id && isLive(link, now)
      )
    ) {
      return yield* new LinkRefused({
        code: "ALREADY_LINKED",
        message: "This address already has a live link to the student.",
      });
    }
    const reader = yield* DatabaseReader;
    const held = yield* linksOfStudent(student._id);
    if (
      Arr.filter(held, (link) => isLive(link, now)).length >= STUDENT_LINK_LIMIT
    ) {
      return yield* new LinkRefused({
        code: "LINK_LIMIT",
        message: "This student holds as many live links as a student may.",
      });
    }
    const guardian = yield* Option.match(Arr.head(links), {
      onNone: () =>
        createPerson(personActor(actor), student.tenantId, guardianName),
      onSome: (link) =>
        reader
          .table("tenantPeople")
          .get(link.guardianPersonId)
          .pipe(Effect.orDie),
    });
    const linkId = yield* (yield* DatabaseWriter)
      .table("guardianLinks")
      .insert({
        email,
        expiresAt: now + Duration.toMillis(LINK_TERM),
        guardianPersonId: guardian._id,
        mismatches: 0,
        startedBy: actor._id,
        state: { status: "pending" },
        studentPersonId: student._id,
        tenantId: student.tenantId,
      })
      .pipe(Effect.orDie);
    const link = yield* reader
      .table("guardianLinks")
      .get(linkId)
      .pipe(Effect.orDie);
    yield* guardianLinkAuthority.record(personActor(actor), link, {
      guardian: guardian._id,
      student: student._id,
      type: "guardian.started",
    });
    return yield* linkViewOf(link, now);
  })
);

/** The links of the signed-in student, newest first, with each guardian's name. */
const mine = FunctionImpl.make(
  databaseSchema,
  spec,
  "mine",
  Effect.fn("guardians.links.mine")(function* () {
    const { person } = yield* Member;
    const now = yield* Clock.currentTimeMillis;
    const links = yield* linksOfStudent(person._id);
    return yield* Effect.forEach(links, (link) =>
      Effect.map(linkViewOf(link, now), (view) => ({
        email: view.email,
        guardianName: view.guardian.name,
        id: view.id,
        status: view.status,
      }))
    );
  })
);

/** The school's links, newest first, a page at a time, clamped to one to `PAGE_LIMIT` rows. */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("guardians.links.list")(function* ({ paginationOpts }) {
    const { tenant } = yield* Member;
    const page = yield* (yield* DatabaseReader)
      .table("guardianLinks")
      .index("by_tenantId", (query) => query.eq("tenantId", tenant._id), "desc")
      .paginate(
        Struct.assign(paginationOpts, {
          numItems: Num.clamp(paginationOpts.numItems, {
            maximum: PAGE_LIMIT,
            minimum: 1,
          }),
        })
      )
      .pipe(Effect.orDie);
    const now = yield* Clock.currentTimeMillis;
    const views = yield* Effect.forEach(
      page.page,
      (link) => linkViewOf(link, now),
      { concurrency: "unbounded" }
    );
    return Struct.assign(page, { page: views });
  })
);

/**
 * Staff checks a link by hand, when the roster holds no NISN or the guardian cannot
 * give one. The consent is granted with the method `staff`, and the staff Person is
 * the checker (ADR 0034). Only a pending link inside its term can be checked.
 */
const verify = FunctionImpl.make(
  databaseSchema,
  spec,
  "verify",
  Effect.fn("guardians.links.verify")(function* () {
    const { person: actor } = yield* Member;
    const link = yield* GuardianLink;
    const now = yield* Clock.currentTimeMillis;
    if (link.state.status !== "pending" || !isLive(link, now)) {
      return yield* new LinkClosed();
    }
    const verified = yield* grantConsent(
      link,
      "staff",
      actor,
      personActor(actor)
    );
    return yield* linkViewOf(verified, now);
  })
);

/** Staff correct the address of a pending link, which keeps its term (`readdressLink`). */
const readdress = FunctionImpl.make(
  databaseSchema,
  spec,
  "readdress",
  Effect.fn("guardians.links.readdress")(function* ({ email }) {
    const { person: actor } = yield* Member;
    const link = yield* GuardianLink;
    const next = yield* readdressLink(link, email, actor);
    return yield* linkViewOf(next, yield* Clock.currentTimeMillis);
  })
);

/**
 * Revokes a link: the relation ends at once and the guardian reaches the child no
 * more. An ended link answers as it stands and journals nothing.
 */
const revoke = FunctionImpl.make(
  databaseSchema,
  spec,
  "revoke",
  Effect.fn("guardians.links.revoke")(function* () {
    const { person: actor } = yield* Member;
    const link = yield* GuardianLink;
    const now = yield* Clock.currentTimeMillis;
    if (link.state.status === "ended") {
      return yield* linkViewOf(link, now);
    }
    const ended = yield* endLink(link, "revoked", personActor(actor), actor);
    return yield* linkViewOf(ended, now);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(start),
  Layer.provide(mine),
  Layer.provide(list),
  Layer.provide(verify),
  Layer.provide(readdress),
  Layer.provide(revoke),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  Layer.provide(personAccess),
  Layer.provide(guardianLinkAccess),
  GroupImpl.finalize
);

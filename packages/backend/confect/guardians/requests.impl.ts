import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { GuardianLink } from "@repo/backend/confect/guardians/access";
import {
  guardianLinkAccess,
  guardianLinkAuthority,
} from "@repo/backend/confect/guardians/authority";
import { requestField } from "@repo/backend/confect/guardians/request";
import spec from "@repo/backend/confect/guardians/requests.spec";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { Clock, Effect, Layer, Struct } from "effect";

/** Requests one list shows: the office answers them as they arrive. */
const REQUEST_PAGE = 50;

/** Writes a parent's request, sealed with the school key. */
const ask = FunctionImpl.make(
  databaseSchema,
  spec,
  "ask",
  Effect.fn("guardians.requests.ask")(function* ({ kind, text }) {
    const link = yield* GuardianLink;
    const createdAt = yield* Clock.currentTimeMillis;
    yield* (yield* DatabaseWriter)
      .table("guardianRequests")
      .insert({
        createdAt,
        kind,
        linkId: link._id,
        sealedText: yield* sealText(
          yield* schoolKeys(link.tenantId),
          requestField({ createdAt, linkId: link._id }),
          text
        ).pipe(Effect.orDie),
        state: "waiting",
        studentPersonId: link.studentPersonId,
        tenantId: link.tenantId,
      })
      .pipe(Effect.orDie);
    return null;
  })
);

/** A parent's requests about one child, newest first. */
const ofLink = FunctionImpl.make(
  databaseSchema,
  spec,
  "ofLink",
  Effect.fn("guardians.requests.ofLink")(function* () {
    const link = yield* GuardianLink;
    const rows = yield* (yield* DatabaseReader)
      .table("guardianRequests")
      .index("by_linkId", (query) => query.eq("linkId", link._id), "desc")
      .take(REQUEST_PAGE)
      .pipe(Effect.orDie);
    const keys = yield* schoolKeys(link.tenantId);
    return yield* Effect.forEach(rows, (row) =>
      Effect.gen(function* () {
        return {
          ...Struct.pick(row, ["createdAt", "kind", "state"]),
          id: row._id,
          text: yield* openText(keys, requestField(row), row.sealedText),
        };
      }).pipe(Effect.orDie)
    );
  })
);

/** What waits for the school office, oldest first. */
const waiting = FunctionImpl.make(
  databaseSchema,
  spec,
  "waiting",
  Effect.fn("guardians.requests.waiting")(function* () {
    const { tenant } = yield* Member;
    const reader = yield* DatabaseReader;
    const rows = yield* reader
      .table("guardianRequests")
      .index("by_tenantId_and_state", (query) =>
        query.eq("tenantId", tenant._id).eq("state", "waiting")
      )
      .take(REQUEST_PAGE)
      .pipe(Effect.orDie);
    const keys = yield* schoolKeys(tenant._id);
    return yield* Effect.forEach(rows, (row) =>
      Effect.gen(function* () {
        const student = yield* reader
          .table("tenantPeople")
          .get(row.studentPersonId);
        return {
          ...Struct.pick(row, ["createdAt", "kind", "linkId", "state"]),
          id: row._id,
          student: student.name,
          text: yield* openText(keys, requestField(row), row.sealedText),
        };
      }).pipe(Effect.orDie)
    );
  })
);

/** Answers a waiting request once, and journals it. A request of another link, or one already answered, changes nothing. */
const answer = FunctionImpl.make(
  databaseSchema,
  spec,
  "answer",
  Effect.fn("guardians.requests.answer")(function* ({ decision, requestId }) {
    const { person } = yield* Member;
    const link = yield* GuardianLink;
    const row = yield* (yield* DatabaseReader)
      .table("guardianRequests")
      .get(requestId)
      .pipe(Effect.orDie);
    if (row.linkId !== link._id || row.state !== "waiting") {
      return null;
    }
    yield* (yield* DatabaseWriter)
      .table("guardianRequests")
      .patch(requestId, { state: decision })
      .pipe(Effect.orDie);
    yield* guardianLinkAuthority.record(personActor(person), link, {
      decision,
      student: link.studentPersonId,
      type: "guardian.request.answered",
    });
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(ask),
  Layer.provide(ofLink),
  Layer.provide(waiting),
  Layer.provide(answer),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(guardianLinkAccess),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);

import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import {
  classAccess,
  classAuthority,
} from "@repo/backend/confect/classroom/authority";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { NarrativeMissing } from "@repo/backend/confect/insight/errors";
import { requireDpia } from "@repo/backend/confect/insight/gate";
import spec from "@repo/backend/confect/insight/narratives.spec";
import { narrativeField } from "@repo/backend/confect/insight/schema";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { sealText } from "@repo/backend/confect/vault/text";
import { Clock, Effect, Layer, Option, Struct } from "effect";

/** The narrative of one student in the allowed class, if one was written. */
const narrativeOf = Effect.fn("insight.narratives.of")(function* (
  personId: GenericId.GenericId<"tenantPeople">
) {
  const row = yield* Class;
  return yield* (yield* DatabaseReader)
    .table("insightNarratives")
    .index("by_classId_and_personId", (query) =>
      query.eq("classId", row._id).eq("personId", personId)
    )
    .first()
    .pipe(Effect.orDie);
});

/** Writes or rewrites a student's narrative, sealed with the school key. */
const write = FunctionImpl.make(
  databaseSchema,
  spec,
  "write",
  Effect.fn("insight.narratives.write")(function* ({ personId, text }) {
    const { person } = yield* Member;
    const row = yield* Class;
    yield* requireDpia(row.tenantId);
    const fields = { classId: row._id, personId };
    const sealedText = yield* sealText(
      yield* schoolKeys(row.tenantId),
      narrativeField(fields),
      text
    ).pipe(Effect.orDie);
    const updatedAt = yield* Clock.currentTimeMillis;
    const found = yield* narrativeOf(personId);
    const writer = yield* DatabaseWriter;
    yield* Option.match(found, {
      onNone: () =>
        writer.table("insightNarratives").insert({
          ...fields,
          authorId: person._id,
          sealedText,
          tenantId: row.tenantId,
          updatedAt,
        }),
      onSome: (narrative) =>
        writer
          .table("insightNarratives")
          .patch(narrative._id, {
            authorId: person._id,
            sealedText,
            updatedAt,
          }),
    }).pipe(Effect.orDie);
    return null;
  })
);

/** Lets the student's guardians read the narrative, and journals it. */
const share = FunctionImpl.make(
  databaseSchema,
  spec,
  "share",
  Effect.fn("insight.narratives.share")(function* ({ personId }) {
    const { person } = yield* Member;
    const found = yield* narrativeOf(personId);
    if (Option.isNone(found)) {
      return yield* new NarrativeMissing();
    }
    yield* (yield* DatabaseWriter)
      .table("insightNarratives")
      .patch(found.value._id, { sharedAt: yield* Clock.currentTimeMillis })
      .pipe(Effect.orDie);
    yield* classAuthority.record(personActor(person), yield* Class, {
      type: "insight.narrative.shared",
    });
    return null;
  })
);

/** Takes the narrative back from the guardians, and journals it. */
const withdraw = FunctionImpl.make(
  databaseSchema,
  spec,
  "withdraw",
  Effect.fn("insight.narratives.withdraw")(function* ({ personId }) {
    const { person } = yield* Member;
    const found = yield* narrativeOf(personId);
    if (Option.isNone(found)) {
      return yield* new NarrativeMissing();
    }
    yield* (yield* DatabaseWriter)
      .table("insightNarratives")
      .replace(
        found.value._id,
        Struct.omit(found.value, ["_creationTime", "_id", "sharedAt"])
      )
      .pipe(Effect.orDie);
    yield* classAuthority.record(personActor(person), yield* Class, {
      type: "insight.narrative.withdrawn",
    });
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(write),
  Layer.provide(share),
  Layer.provide(withdraw),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  GroupImpl.finalize
);

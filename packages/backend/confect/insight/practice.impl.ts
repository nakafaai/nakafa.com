import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  isShared,
  practiceOf,
  sharesOf,
} from "@repo/backend/confect/insight/practice";
import spec from "@repo/backend/confect/insight/practice.spec";
import type { PracticeTopic } from "@repo/backend/confect/insight/schema";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Array as Arr, Clock, Effect, Layer, Option, Struct } from "effect";

/** The row of one shared topic, if the Person shares it. */
const shareOf = Effect.fn("insight.practice.share")(function* (
  personId: GenericId.GenericId<"tenantPeople">,
  topic: typeof PracticeTopic.Type
) {
  return yield* (yield* DatabaseReader)
    .table("insightShares")
    .index("by_personId_and_topic", (query) =>
      query
        .eq("personId", personId)
        .eq("countryKey", topic.countryKey)
        .eq("examKey", topic.examKey)
        .eq("trackKey", topic.trackKey)
    )
    .first()
    .pipe(Effect.orDie);
});

/** The viewer's own practice by topic, with whether they share each one. */
const topics = FunctionImpl.make(
  databaseSchema,
  spec,
  "topics",
  Effect.fn("insight.practice.topics")(function* () {
    const { person } = yield* Member;
    const practice = yield* practiceOf(person);
    const shares = yield* sharesOf(person._id);
    return Arr.map(practice, (topic) => ({
      ...topic,
      shared: isShared(shares, topic),
    }));
  })
);

/** Shares a topic with the viewer's school. Sharing it twice changes nothing. */
const share = FunctionImpl.make(
  databaseSchema,
  spec,
  "share",
  Effect.fn("insight.practice.shareTopic")(function* (args) {
    const { person, tenant } = yield* Member;
    const found = yield* shareOf(person._id, args);
    if (Option.isSome(found)) {
      return null;
    }
    yield* (yield* DatabaseWriter)
      .table("insightShares")
      .insert({
        ...Struct.omit(args, ["slug"]),
        personId: person._id,
        sharedAt: yield* Clock.currentTimeMillis,
        tenantId: tenant._id,
      })
      .pipe(Effect.orDie);
    return null;
  })
);

/** Takes a topic back. It leaves the teacher's screen at once, and stopping twice changes nothing. */
const stop = FunctionImpl.make(
  databaseSchema,
  spec,
  "stop",
  Effect.fn("insight.practice.stop")(function* (args) {
    const { person } = yield* Member;
    const found = yield* shareOf(person._id, args);
    if (Option.isSome(found)) {
      yield* (yield* DatabaseWriter)
        .table("insightShares")
        .delete(found.value._id)
        .pipe(Effect.orDie);
    }
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(topics),
  Layer.provide(share),
  Layer.provide(stop),
  Layer.provide(session),
  Layer.provide(member),
  GroupImpl.finalize
);

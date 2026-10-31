import type { GenericId } from "@confect/core";
import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { PracticeTopic } from "@repo/backend/confect/insight/schema";
import {
  Array as Arr,
  Effect,
  Number as Num,
  Record,
  Result,
  Struct,
} from "effect";

/** Sets one student's practice reads: more than the catalog holds. */
const SET_PAGE = 200;

/** Topics one student shares: more than the catalog holds. */
const SHARE_PAGE = 50;

/** One topic as a key, to compare a set with a share. */
const topicKey = (topic: typeof PracticeTopic.Type) =>
  Arr.join([topic.countryKey, topic.examKey, topic.trackKey], "/");

/** The Person's scored sets by topic, each with the sets behind it and their mean score. A Person with no account has none. */
export const practiceOf = Effect.fn("insight.practice.of")(function* (
  person: TenantPeopleDoc
) {
  if (person.account.state !== "claimed") {
    return [];
  }
  const { userId } = person.account;
  const rows = yield* (yield* DatabaseReader)
    .table("tryoutSetProgress")
    .index("by_userId_and_set", (query) => query.eq("userId", userId))
    .take(SET_PAGE)
    .pipe(Effect.orDie);
  const scored = Arr.filterMap(rows, (row) =>
    row.publishedScore === null
      ? Result.failVoid
      : Result.succeed({ ...row, score: row.publishedScore })
  );
  return Arr.map(Record.values(Arr.groupBy(scored, topicKey)), (sets) => ({
    ...Struct.pick(Arr.headNonEmpty(sets), [
      "countryKey",
      "examKey",
      "trackKey",
    ]),
    mean: Num.sumAll(Arr.map(sets, (set) => set.score)) / sets.length,
    sets: sets.length,
  }));
});

/** The topics a Person shares. */
export const sharesOf = Effect.fn("insight.practice.shares")(function* (
  personId: GenericId.GenericId<"tenantPeople">
) {
  return yield* (yield* DatabaseReader)
    .table("insightShares")
    .index("by_personId_and_topic", (query) => query.eq("personId", personId))
    .take(SHARE_PAGE)
    .pipe(Effect.orDie);
});

/** Whether a topic is one of the shares. */
export const isShared = (
  shares: readonly (typeof PracticeTopic.Type)[],
  topic: typeof PracticeTopic.Type
) => Arr.contains(Arr.map(shares, topicKey), topicKey(topic));

/** What a teacher sees of a student's practice: the shared topics and nothing else. */
export const sharedPracticeOf = Effect.fn("insight.practice.shared")(function* (
  person: TenantPeopleDoc
) {
  const shares = yield* sharesOf(person._id);
  if (Arr.isReadonlyArrayEmpty(shares)) {
    return [];
  }
  const practice = yield* practiceOf(person);
  return Arr.filter(practice, (topic) => isShared(shares, topic));
});

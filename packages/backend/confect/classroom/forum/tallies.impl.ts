import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import type {
  ClassroomMessagesDoc,
  ClassroomTalliesDoc,
} from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { classAccess } from "@repo/backend/confect/classroom/authority";
import {
  MessageHidden,
  ReactionLimit,
  VoteRefused,
} from "@repo/backend/confect/classroom/forum/errors";
import {
  classMessage,
  classThread,
  missing,
} from "@repo/backend/confect/classroom/forum/lookup";
import type { ReadPlace } from "@repo/backend/confect/classroom/forum/read";
import spec from "@repo/backend/confect/classroom/forum/tallies.spec";
import {
  castVote,
  REACTION_LIMIT,
  tallyView,
  toggleReaction,
} from "@repo/backend/confect/classroom/forum/tally";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Array as Arr, Effect, Layer, Match, Option, Struct } from "effect";

/** The most tallies one read takes: more than a reader's loaded messages carry. */
const TALLY_READ_LIMIT = 256;

/** The tally of one message, once it holds one. */
const tallyOf = Effect.fn("classroom.forum.tallies.of")(function* (
  messageId: GenericId.GenericId<"classroomMessages">
) {
  return yield* (yield* DatabaseReader)
    .table("classroomTallies")
    .index("by_messageId", (query) => query.eq("messageId", messageId))
    .first()
    .pipe(Effect.orDie);
});

/** The stored tallies of a place from `since` on. A discussion's opening message stands in its channel, so it joins them. */
const placeTallies = Effect.fn("classroom.forum.tallies.place")(function* (
  place: typeof ReadPlace.Type,
  since: number
) {
  const reader = yield* DatabaseReader;
  const tallies = (
    channelId: GenericId.GenericId<"classroomChannels">,
    threadId: GenericId.GenericId<"classroomThreads"> | undefined
  ) =>
    reader
      .table("classroomTallies")
      .index("by_channelId_and_threadId_and_messageAt", (query) =>
        query
          .eq("channelId", channelId)
          .eq("threadId", threadId)
          .gte("messageAt", since)
      )
      .take(TALLY_READ_LIMIT)
      .pipe(Effect.orDie);
  return yield* Match.value(place).pipe(
    Match.tagsExhaustive({
      channel: ({ channelId }) => tallies(channelId, undefined),
      discussion: ({ number }) =>
        Effect.gen(function* () {
          const thread = yield* classThread(number, "forum.read");
          const replies = yield* tallies(thread.channelId, thread._id);
          const opening = yield* reader
            .table("classroomMessages")
            .index("by_channelId_and_clientKey", (query) =>
              query
                .eq("channelId", thread.channelId)
                .eq("clientKey", thread.clientKey)
            )
            .first()
            .pipe(Effect.orDie);
          const first = yield* Option.match(opening, {
            onNone: () => Effect.succeedNone,
            onSome: (message) => tallyOf(message._id),
          });
          return Arr.appendAll(Option.toArray(first), replies);
        }),
    })
  );
});

/**
 * The tallies of a place for the viewer. A channel's tallies come from an index by
 * time, so the read holds only the messages that carry one, and it runs again
 * without the page of messages when a class reacts.
 */
const since = FunctionImpl.make(
  databaseSchema,
  spec,
  "since",
  Effect.fn("classroom.forum.tallies.since")(function* ({
    place,
    since: from,
  }) {
    const { person } = yield* Member;
    const rows = yield* placeTallies(place, from);
    return Arr.map(rows, (row) => tallyView(row, person._id));
  })
);

/** Writes a message's tally, and removes the row once nobody reacted or voted. */
const writeTally = Effect.fn("classroom.forum.tallies.write")(function* (
  message: ClassroomMessagesDoc,
  current: Option.Option<ClassroomTalliesDoc>,
  change: Pick<ClassroomTalliesDoc, "reactions" | "votes">
) {
  const writer = (yield* DatabaseWriter).table("classroomTallies");
  const empty =
    Arr.isReadonlyArrayEmpty(change.reactions) &&
    Arr.isReadonlyArrayEmpty(change.votes);
  yield* Option.match(current, {
    onNone: () =>
      writer.insert({
        ...change,
        channelId: message.channelId,
        classId: message.classId,
        messageAt: message.createdAt,
        messageId: message._id,
        tenantId: message.tenantId,
        ...(message.threadId === undefined
          ? {}
          : { threadId: message.threadId }),
      }),
    onSome: (row) =>
      empty
        ? writer.delete(row._id)
        : writer.replace(
            row._id,
            Struct.assign(Struct.omit(row, ["_creationTime", "_id"]), change)
          ),
  }).pipe(Effect.orDie);
});

/** Gives an emoji to a message, or takes it back when the viewer gave it. */
const react = FunctionImpl.make(
  databaseSchema,
  spec,
  "react",
  Effect.fn("classroom.forum.tallies.react")(function* ({ emoji, messageId }) {
    const { person } = yield* Member;
    const message = yield* classMessage(messageId, "forum.post");
    if (message.sealedText === null) {
      return yield* new MessageHidden();
    }
    const tally = yield* tallyOf(messageId);
    const reactions = toggleReaction(
      Option.match(tally, {
        onNone: () => [],
        onSome: (row) => row.reactions,
      }),
      emoji,
      person._id
    );
    if (reactions.length > REACTION_LIMIT) {
      return yield* new ReactionLimit();
    }
    yield* writeTally(message, tally, {
      reactions,
      votes: Option.match(tally, {
        onNone: () => [],
        onSome: (row) => row.votes,
      }),
    });
    return null;
  })
);

/**
 * Sets the viewer's choice in a poll, which replaces their last one, and an empty
 * choice takes it back. A choice the poll does not hold, or several in a poll of
 * one choice, is refused.
 */
const vote = FunctionImpl.make(
  databaseSchema,
  spec,
  "vote",
  Effect.fn("classroom.forum.tallies.vote")(function* ({ messageId, options }) {
    const { person } = yield* Member;
    const message = yield* classMessage(messageId, "forum.post");
    if (message.sealedText === null) {
      return yield* new MessageHidden();
    }
    if (message.poll === undefined) {
      return yield* missing("forum.post");
    }
    const chosen = Arr.dedupe(options);
    const held = message.poll.sealedOptions.length;
    if (
      Arr.some(chosen, (option) => option < 0 || option >= held) ||
      (!message.poll.multiple && chosen.length > 1)
    ) {
      return yield* new VoteRefused();
    }
    const tally = yield* tallyOf(messageId);
    yield* writeTally(message, tally, {
      reactions: Option.match(tally, {
        onNone: () => [],
        onSome: (found) => found.reactions,
      }),
      votes: castVote(
        Option.match(tally, {
          onNone: () => [],
          onSome: (found) => found.votes,
        }),
        chosen,
        person._id
      ),
    });
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(since),
  Layer.provide(react),
  Layer.provide(vote),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  GroupImpl.finalize
);

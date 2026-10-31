import type { Ref } from "@confect/core";
import type {
  OptimisticLocalStore as LocalStore,
  OptimisticUpdate,
} from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Array as Arr, Option } from "effect";

/** The tally of one message for the viewer, as a chat shows it. */
export type ForumTally = Ref.Returns<
  typeof classroom.forum.tallies.since
>[number];

const { since } = classroom.forum.tallies;

/** A tally of a message that nobody reacted to or voted on yet. */
const emptyTally = (messageId: Id<"classroomMessages">): ForumTally => ({
  messageId,
  reactions: [],
  votes: [],
});

/** Changes one message's tally in every read that the store holds of the class, and drops it once it is empty. */
const changeTally = (
  localStore: LocalStore.OptimisticLocalStore,
  classId: Id<"classes">,
  messageId: Id<"classroomMessages">,
  change: (tally: ForumTally) => ForumTally
) => {
  for (const query of localStore.getAllQueries(since)) {
    if (Option.isSome(query.value) && query.args.classId === classId) {
      const held = Arr.findFirst(
        query.value.value,
        (tally) => tally.messageId === messageId
      );
      const next = change(Option.getOrElse(held, () => emptyTally(messageId)));
      const others = Arr.filter(
        query.value.value,
        (tally) => tally.messageId !== messageId
      );
      localStore.setQuery(
        since,
        query.args,
        Option.some(
          Arr.isReadonlyArrayEmpty(next.reactions) &&
            Arr.isReadonlyArrayEmpty(next.votes)
            ? others
            : Arr.append(others, next)
        )
      );
    }
  }
};

/** The reactions after the viewer presses an emoji: their own goes, or joins, and an emoji nobody holds leaves. */
const pressedReactions = (
  reactions: ForumTally["reactions"],
  emoji: string
) => {
  const held = Arr.findFirst(reactions, (row) => row.emoji === emoji);
  if (Option.isNone(held)) {
    return Arr.append(reactions, { count: 1, emoji, mine: true });
  }
  return Arr.filter(
    Arr.map(reactions, (row) =>
      row.emoji === emoji
        ? {
            ...row,
            count: row.count + (row.mine ? -1 : 1),
            mine: !row.mine,
          }
        : row
    ),
    (row) => row.count > 0
  );
};

/** The votes after the viewer's choice: their last one leaves, and each chosen option counts them. */
const chosenVotes = (
  votes: ForumTally["votes"],
  options: readonly number[]
) => {
  const others = Arr.filter(
    Arr.map(votes, (row) => ({
      ...row,
      count: row.count - (row.mine ? 1 : 0),
      mine: false,
    })),
    (row) => row.count > 0
  );
  return Arr.reduce(options, others, (rows, option) =>
    Arr.some(rows, (row) => row.option === option)
      ? Arr.map(rows, (row) =>
          row.option === option
            ? { ...row, count: row.count + 1, mine: true }
            : row
        )
      : Arr.append(rows, { count: 1, mine: true, option })
  );
};

/** Shows the viewer's press on an emoji at once. */
export const reactUpdate: OptimisticUpdate<
  typeof classroom.forum.tallies.react
> = (localStore, args) => {
  changeTally(localStore, args.classId, args.messageId, (tally) => ({
    ...tally,
    reactions: pressedReactions(tally.reactions, args.emoji),
  }));
};

/** Shows the viewer's vote at once. */
export const voteUpdate: OptimisticUpdate<
  typeof classroom.forum.tallies.vote
> = (localStore, args) => {
  changeTally(localStore, args.classId, args.messageId, (tally) => ({
    ...tally,
    votes: chosenVotes(tally.votes, args.options),
  }));
};

/** How a poll reads once its votes are in: each option's share of every vote, as a whole percent. */
export const shareOf = (count: number, total: number) =>
  total === 0 ? 0 : Math.round((count / total) * 100);

import type {
  forumPostWithMetadataValidator,
  forumReactionUsersValidator,
} from "@repo/backend/confect/classes/forums/validators";
import type { schoolClassReactionCountValidator } from "@repo/backend/confect/classes/schema";
import { Array as Arr, Option } from "effect";

type ReactionCount = typeof schoolClassReactionCountValidator.Type;
type ReactionPreview = typeof forumReactionUsersValidator.Type;
type ReactionPost = typeof forumPostWithMetadataValidator.Type;

/** Reaction fields of one forum post; its reactor previews may be absent. */
type ReactionState = Pick<ReactionPost, "myReactions" | "reactionCounts"> &
  Partial<Pick<ReactionPost, "reactionUsers">>;

/** Apply one reaction delta while removing empty counters. */
function updateCounts(
  counts: readonly ReactionCount[],
  emoji: string,
  added: boolean
) {
  const current = Arr.findFirst(counts, (reaction) => reaction.emoji === emoji);
  const currentCount = Option.match(current, {
    onNone: () => 0,
    onSome: (reaction) => reaction.count,
  });
  const nextCount = currentCount + (added ? 1 : -1);

  if (nextCount <= 0) {
    return Arr.filter(counts, (reaction) => reaction.emoji !== emoji);
  }

  if (Option.isNone(current)) {
    return [...counts, { count: nextCount, emoji }];
  }

  return Arr.map(counts, (reaction) =>
    reaction.emoji === emoji ? { ...reaction, count: nextCount } : reaction
  );
}

/** Update the bounded reactor-name preview for one reaction. */
function updateReactors(
  reactors: readonly string[],
  reactorName: string | undefined,
  added: boolean,
  count: number
) {
  if (!reactorName) {
    return reactors.slice(0, count);
  }

  if (added && !reactors.includes(reactorName)) {
    return [...reactors, reactorName].slice(0, count);
  }

  if (!added) {
    const index = reactors.indexOf(reactorName);
    if (index >= 0) {
      return [...reactors.slice(0, index), ...reactors.slice(index + 1)].slice(
        0,
        count
      );
    }
  }

  return reactors.slice(0, count);
}

/** Apply one reaction delta to detailed reactor previews. */
function updatePreviews(
  previews: readonly ReactionPreview[],
  emoji: string,
  reactorName: string | undefined,
  added: boolean
) {
  const current = Arr.findFirst(
    previews,
    (reaction) => reaction.emoji === emoji
  );
  const currentCount = Option.match(current, {
    onNone: () => 0,
    onSome: (reaction) => reaction.count,
  });
  const nextCount = currentCount + (added ? 1 : -1);

  if (nextCount <= 0) {
    return Arr.filter(previews, (reaction) => reaction.emoji !== emoji);
  }

  if (Option.isNone(current)) {
    return [
      ...previews,
      {
        count: nextCount,
        emoji,
        reactors: reactorName ? [reactorName] : [],
      },
    ];
  }

  return Arr.map(previews, (reaction) =>
    reaction.emoji === emoji
      ? {
          ...reaction,
          count: nextCount,
          reactors: updateReactors(
            reaction.reactors,
            reactorName,
            added,
            nextCount
          ),
        }
      : reaction
  );
}

/** Toggle one current-user reaction in a subscribed forum result. */
export function toggleReactionState<T extends ReactionState>(
  state: T,
  emoji: string,
  reactorName?: string
): T {
  const added = !state.myReactions.includes(emoji);
  const myReactions = added
    ? [...state.myReactions, emoji]
    : Arr.filter(state.myReactions, (reaction) => reaction !== emoji);
  const reactionCounts = updateCounts(state.reactionCounts, emoji, added);

  if (!state.reactionUsers) {
    return { ...state, myReactions, reactionCounts };
  }

  return {
    ...state,
    myReactions,
    reactionCounts,
    reactionUsers: updatePreviews(
      state.reactionUsers,
      emoji,
      reactorName,
      added
    ),
  };
}

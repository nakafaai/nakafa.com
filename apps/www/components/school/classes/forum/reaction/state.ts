interface ReactionCount {
  count: number;
  emoji: string;
}

interface ReactionPreview extends ReactionCount {
  reactors: string[];
}

interface ReactionState {
  myReactions: string[];
  reactionCounts: ReactionCount[];
  reactionUsers?: ReactionPreview[];
}

function updateCounts(counts: ReactionCount[], emoji: string, added: boolean) {
  const current = counts.find((reaction) => reaction.emoji === emoji);
  const nextCount = (current?.count ?? 0) + (added ? 1 : -1);

  if (nextCount <= 0) {
    return counts.filter((reaction) => reaction.emoji !== emoji);
  }

  if (!current) {
    return [...counts, { count: nextCount, emoji }];
  }

  return counts.map((reaction) =>
    reaction.emoji === emoji ? { ...reaction, count: nextCount } : reaction
  );
}

function updateReactors(
  reactors: string[],
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

function updatePreviews(
  previews: ReactionPreview[],
  emoji: string,
  reactorName: string | undefined,
  added: boolean
) {
  const current = previews.find((reaction) => reaction.emoji === emoji);
  const nextCount = (current?.count ?? 0) + (added ? 1 : -1);

  if (nextCount <= 0) {
    return previews.filter((reaction) => reaction.emoji !== emoji);
  }

  if (!current) {
    return [
      ...previews,
      {
        count: nextCount,
        emoji,
        reactors: reactorName ? [reactorName] : [],
      },
    ];
  }

  return previews.map((reaction) =>
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
    : state.myReactions.filter((reaction) => reaction !== emoji);
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

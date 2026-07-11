import { describe, expect, it } from "vitest";
import { toggleReactionState } from "@/components/school/classes/forum/reaction/state";

const state = {
  id: "forum-1",
  myReactions: ["👍"],
  reactionCounts: [
    { count: 2, emoji: "👍" },
    { count: 1, emoji: "🎉" },
  ],
  reactionUsers: [
    { count: 2, emoji: "👍", reactors: ["Ari", "Budi"] },
    { count: 1, emoji: "🎉", reactors: ["Citra"] },
  ],
};

describe("toggleReactionState", () => {
  it("adds a new reaction without mutating the source", () => {
    const result = toggleReactionState(state, "🔥", "Dewi");

    expect(result).toEqual({
      ...state,
      myReactions: ["👍", "🔥"],
      reactionCounts: [...state.reactionCounts, { count: 1, emoji: "🔥" }],
      reactionUsers: [
        ...state.reactionUsers,
        { count: 1, emoji: "🔥", reactors: ["Dewi"] },
      ],
    });
    expect(state.myReactions).toEqual(["👍"]);
  });

  it("removes the current reaction and its preview name", () => {
    const result = toggleReactionState(state, "👍", "Ari");

    expect(result.myReactions).toEqual([]);
    expect(result.reactionCounts[0]).toEqual({ count: 1, emoji: "👍" });
    expect(result.reactionUsers[0]).toEqual({
      count: 1,
      emoji: "👍",
      reactors: ["Budi"],
    });
  });

  it("removes reaction rows when their count reaches zero", () => {
    const result = toggleReactionState(
      { ...state, myReactions: ["🎉"] },
      "🎉",
      "Citra"
    );

    expect(result.reactionCounts).toEqual([{ count: 2, emoji: "👍" }]);
    expect(result.reactionUsers).toEqual([
      { count: 2, emoji: "👍", reactors: ["Ari", "Budi"] },
    ]);
  });

  it("supports list rows without reaction previews", () => {
    const result = toggleReactionState(
      {
        myReactions: [],
        reactionCounts: [{ count: 2, emoji: "👍" }],
      },
      "👍"
    );

    expect(result).toEqual({
      myReactions: ["👍"],
      reactionCounts: [{ count: 3, emoji: "👍" }],
    });
  });

  it("updates an existing preview with a newly added reactor", () => {
    const result = toggleReactionState(
      { ...state, myReactions: [] },
      "👍",
      "Dewi"
    );

    expect(result.reactionCounts[0]).toEqual({ count: 3, emoji: "👍" });
    expect(result.reactionUsers[0]).toEqual({
      count: 3,
      emoji: "👍",
      reactors: ["Ari", "Budi", "Dewi"],
    });
  });

  it("keeps bounded previews when the current user name is unavailable", () => {
    const result = toggleReactionState({ ...state, myReactions: [] }, "👍");

    expect(result.reactionUsers[0]).toEqual({
      count: 3,
      emoji: "👍",
      reactors: ["Ari", "Budi"],
    });
  });

  it("keeps other preview names when the current name is not previewed", () => {
    const result = toggleReactionState(state, "👍", "Dewi");

    expect(result.reactionUsers[0]).toEqual({
      count: 1,
      emoji: "👍",
      reactors: ["Ari"],
    });
  });

  it("does not duplicate a reactor already present in the preview", () => {
    const result = toggleReactionState(
      { ...state, myReactions: [] },
      "👍",
      "Ari"
    );

    expect(result.reactionUsers[0]).toEqual({
      count: 3,
      emoji: "👍",
      reactors: ["Ari", "Budi"],
    });
  });

  it("creates a preview without inventing an unavailable name", () => {
    const result = toggleReactionState(state, "🔥");

    expect(result.reactionUsers.at(-1)).toEqual({
      count: 1,
      emoji: "🔥",
      reactors: [],
    });
  });
});

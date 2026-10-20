import { DateTime, Record as Rec, Schema } from "effect";
import { createStore } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Tracks content views to prevent rapid duplicate recording within session.
 *
 * Design: Local deduplication prevents spam.
 * Backend tracks first and last view timestamps for accurate analytics.
 */

const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

const StateSchema = Schema.Struct({
  viewedSlugs: Schema.Record(Schema.String, Schema.Finite),
});

type State = typeof StateSchema.Type;

interface Actions {
  isViewed: (key: string) => boolean;
  markAsViewed: (key: string) => void;
}

export type ContentViewsStore = State & Actions;

const initialState: State = {
  viewedSlugs: {},
};

export const createContentViewsStore = () =>
  createStore<ContentViewsStore>()(
    persist(
      (set, get) => ({
        ...initialState,

        markAsViewed: (key) => {
          const viewedAt = DateTime.toEpochMillis(DateTime.nowUnsafe());
          set((state) =>
            state.viewedSlugs[key] === viewedAt
              ? state
              : { viewedSlugs: Rec.set(state.viewedSlugs, key, viewedAt) }
          );
        },

        /**
         * Checks if content has been viewed in current session.
         * Returns true if viewed within TTL (30 minutes).
         * Allows re-views after TTL expires to update backend lastViewedAt.
         */
        isViewed: (key) => {
          const viewedAt = get().viewedSlugs[key];
          if (viewedAt === undefined) {
            return false;
          }
          return (
            DateTime.toEpochMillis(DateTime.nowUnsafe()) - viewedAt <
            SESSION_TTL
          );
        },
      }),
      {
        name: "nakafa-content-views",
        version: 1,
      }
    )
  );

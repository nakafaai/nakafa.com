import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Schema } from "effect";
import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { ConversationViewSchema } from "@/components/school/classes/forum/conversation/data/view/model";

/** A forum id as a record key: Confect's id Schema does not carry the key type that `Schema.Record` needs. */
const ForumKeySchema = Schema.NonEmptyString.pipe(
  Schema.refine(Schema.is(IdSchema("schoolClassForums")))
);

export const ForumReplyTargetSchema = Schema.Struct({
  postId: IdSchema("schoolClassForumPosts"),
  userName: Schema.String,
});
export type ForumReplyTarget = typeof ForumReplyTargetSchema.Type;

export const ConversationScrollSnapshotSchema = Schema.Struct({
  lastPostId: Schema.NullOr(IdSchema("schoolClassForumPosts")),
  offset: Schema.Finite,
  renderedRowCount: Schema.Finite,
  view: ConversationViewSchema,
  wasAtBottom: Schema.Boolean,
});
export type ConversationScrollSnapshot =
  typeof ConversationScrollSnapshotSchema.Type;

const StateSchema = Schema.Struct({
  conversationScrollSnapshotByForumId: Schema.Record(
    ForumKeySchema,
    Schema.UndefinedOr(ConversationScrollSnapshotSchema)
  ),
  isHydrated: Schema.Boolean,
  replyTargetByForumId: Schema.Record(
    ForumKeySchema,
    Schema.UndefinedOr(ForumReplyTargetSchema)
  ),
});
type State = typeof StateSchema.Type;

interface Actions {
  saveConversationScrollSnapshot: (
    forumId: Id<"schoolClassForums">,
    snapshot: ConversationScrollSnapshot
  ) => void;
  setForumReplyTarget: (
    forumId: Id<"schoolClassForums">,
    replyTarget: ForumReplyTarget | null
  ) => void;
  setHydrated: (isHydrated: boolean) => void;
}

export type ForumSessionStore = State & Actions;

const initialState: State = {
  isHydrated: false,
  conversationScrollSnapshotByForumId: {},
  replyTargetByForumId: {},
};

const initialPersistedState = {
  conversationScrollSnapshotByForumId: {},
} satisfies Pick<State, "conversationScrollSnapshotByForumId">;

/**
 * Creates one class-scoped session store for forum reply state and scroll restoration.
 *
 * Hydration is intentionally manual so the forum provider can rehydrate
 * session-backed state on the client before the transcript renders.
 */
export function createForumSessionStore(classId: string) {
  return createStore<ForumSessionStore>()(
    persist(
      immer((set) => ({
        ...initialState,

        saveConversationScrollSnapshot: (forumId, snapshot) => {
          set((state) => {
            state.conversationScrollSnapshotByForumId[forumId] = snapshot;
          });
        },

        setHydrated: (isHydrated) => {
          set((state) => {
            state.isHydrated = isHydrated;
          });
        },

        setForumReplyTarget: (forumId, replyTarget) => {
          set((state) => {
            if (!replyTarget) {
              delete state.replyTargetByForumId[forumId];
              return;
            }

            state.replyTargetByForumId[forumId] = replyTarget;
          });
        },
      })),
      {
        name: `nakafa-forum-session:${classId}`,
        migrate: () => initialPersistedState,
        partialize: (state) => ({
          conversationScrollSnapshotByForumId:
            state.conversationScrollSnapshotByForumId,
        }),
        skipHydration: true,
        storage: createJSONStorage(() => sessionStorage),
        version: 4,
      }
    )
  );
}

import { Id } from "@repo/backend/confect/_generated/id";
import { DiscussionNumber } from "@repo/backend/confect/classroom/forum/message";
import type { ReadPlace } from "@repo/backend/confect/classroom/forum/read";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { createContext, use } from "react";

/**
 * The channel a forum shows, its class and school, whether the viewer manages the forum, writes in
 * it and may mention everyone in it, the discussion of the channel when the view is that
 * discussion's, and the message the address asks the place to bring into view.
 */
const ChannelScope = Schema.Struct({
  canManage: Schema.Boolean,
  canPost: Schema.Boolean,
  channelId: Id("classroomChannels"),
  classId: Id("classes"),
  discussion: Schema.UndefinedOr(DiscussionNumber),
  everyone: Schema.Boolean,
  jump: Schema.Option(Id("classroomMessages")),
  slug: TenantSlug,
});

/**
 * Whether the place around the caller is on screen, not kept out of sight for the reader's next press. It stands apart
 * from the scope every message reads, so showing a kept chat renders none of its messages again.
 */
export const PlaceShownContext = createContext(true);

/** The channel, or the discussion, that the view provides to its messages and its composer. */
export const ChannelScopeContext = createContext<
  typeof ChannelScope.Type | null
>(null);

/** Reads the channel of the channel view around the caller. */
export function useChannelScope() {
  const value = use(ChannelScopeContext);

  if (value === null) {
    throw new Error("useChannelScope must be used within a channel view");
  }

  return value;
}

/**
 * The place whose read mark the channel scope around the caller reads and moves: its discussion
 * when the view is one, otherwise its channel.
 */
export function useReadPlace(): typeof ReadPlace.Type {
  const { channelId, discussion } = useChannelScope();

  return discussion === undefined
    ? { _tag: "channel", channelId }
    : { _tag: "discussion", number: discussion };
}

/**
 * The key the place a reader left a chat or a discussion at is kept under in the browser: a channel by its ID, a
 * discussion by its class and its number, which counts within the class.
 */
export const placeChatOf = ({
  channelId,
  classId,
  discussion,
}: Pick<typeof ChannelScope.Type, "channelId" | "classId" | "discussion">) =>
  discussion === undefined
    ? `channel:${channelId}`
    : `discussion:${classId}:${discussion}`;

/** The key of the place of the chat or the discussion around the caller. */
export function usePlaceChat() {
  return placeChatOf(useChannelScope());
}

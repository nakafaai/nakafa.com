import { Id } from "@repo/backend/confect/_generated/id";
import { DiscussionNumber } from "@repo/backend/confect/classroom/forum/message";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { createContext, use } from "react";

/**
 * The channel a forum shows, its class and school, whether the viewer manages the forum, and the
 * discussion of the channel when the view is that discussion's.
 */
const ChannelScope = Schema.Struct({
  canManage: Schema.Boolean,
  channelId: Id("classroomChannels"),
  classId: Id("classes"),
  discussion: Schema.UndefinedOr(DiscussionNumber),
  slug: TenantSlug,
});

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

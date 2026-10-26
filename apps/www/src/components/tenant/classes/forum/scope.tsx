import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { createContext, use } from "react";

/** The channel a forum shows, its class and school, and whether the viewer manages the forum. */
const ChannelScope = Schema.Struct({
  canManage: Schema.Boolean,
  channelId: Id("classroomChannels"),
  classId: Id("classes"),
  slug: TenantSlug,
});

/** The channel that the channel view provides to its messages and its composer. */
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

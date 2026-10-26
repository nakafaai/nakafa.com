import type { ChannelView } from "@repo/backend/confect/classroom/forum/channel";

/** The name a channel shows: the general channel's label in the viewer's language, or a topic's own name. */
export const channelLabel = (
  channel: Pick<typeof ChannelView.Type, "kind" | "name">,
  general: string
) => (channel.kind === "general" ? general : channel.name);

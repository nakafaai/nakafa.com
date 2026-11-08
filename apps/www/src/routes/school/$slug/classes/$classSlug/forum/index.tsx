import { createFileRoute } from "@tanstack/react-router";

/** The forum's own address: the channel list, or the channel its search names. Its layout draws the page. */
export const Route = createFileRoute("/school/$slug/classes/$classSlug/forum/")(
  {}
);

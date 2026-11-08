import { createFileRoute } from "@tanstack/react-router";

/**
 * One numbered discussion of a class's forum, such as `/classes/fisika-x-1/forum/12` (ADR 0026). The forum's layout
 * draws it beside its channel, so a move between the channel and its discussions never remounts the page.
 */
export const Route = createFileRoute(
  "/school/$slug/classes/$classSlug/forum/$number"
)({});

import { parseAsString } from "nuqs/server";

/** Query-string parsers used by class forum routes and overlays. */
export const forumSearchParsers = {
  forum: parseAsString,
};

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { createParser } from "nuqs/server";

/** Parse and serialize one forum id in the class forum query string. */
const parseAsForumId = createParser<Id<"schoolClassForums">>({
  parse: (value) => value as Id<"schoolClassForums">,
  serialize: (value) => value,
});

/** Query-string parsers used by class forum routes and overlays. */
export const forumSearchParsers = {
  forum: parseAsForumId,
};

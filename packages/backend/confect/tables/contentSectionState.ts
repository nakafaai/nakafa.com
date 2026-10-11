import { Table } from "@confect/core";
import { sectionStateValidator } from "@repo/backend/confect/contents/sections/schema";

/**
 * The one record that says which release the section index was last built
 * complete for, and with which embedding model. Search trusts the index only
 * while this record names the active release. Like `contentSections`, it is
 * derived: deleting it makes search use words until the next build finishes.
 */
export default Table.make(() => sectionStateValidator).index("by_key", ["key"]);

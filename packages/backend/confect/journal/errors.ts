import { Schema } from "effect";

/**
 * A cursor window that would hold more handled entries than its consumer allows, so
 * the run is refused. The run fails before it writes, so the cursor keeps its place.
 */
export class JournalCursorTooLarge extends Schema.TaggedError<JournalCursorTooLarge>()(
  "JournalCursorTooLarge",
  {
    entries: Schema.Finite,
    limit: Schema.Finite,
  }
) {}

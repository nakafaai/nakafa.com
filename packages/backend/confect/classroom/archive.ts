import type { ClassroomPostsDoc } from "@repo/backend/confect/_generated/docs";
import { Array as Arr, Clock, Effect } from "effect";

/**
 * A classroom row that its author or its teacher archives and brings back: an announcement, a task, a channel or a
 * discussion. `archivedAt`, the time it was archived, is the one mark of it: an archived row leaves its list and its
 * home, stays readable where it is named, and comes back as it stood.
 */
type Archivable = Pick<ClassroomPostsDoc, "archivedAt">;

/** Whether a classroom row is archived. */
export const isArchived = (row: Archivable) => row.archivedAt !== undefined;

/** The rows of a page on the shelf a list asks for: the archived ones, or the ones still in use. */
export const onShelf = <Row extends Archivable>(
  rows: readonly Row[],
  archived: boolean
) => Arr.filter(rows, (row) => isArchived(row) === archived);

/** The mark that archiving a row writes, the time now, or that bringing it back writes, none. */
export const archiveMark = Effect.fn("classroom.archive.mark")(function* (
  archived: boolean
) {
  return archived ? yield* Clock.currentTimeMillis : undefined;
});

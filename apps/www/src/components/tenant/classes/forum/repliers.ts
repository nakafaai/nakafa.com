import { REPLIER_LIMIT } from "@repo/backend/confect/classroom/forum/face";
import { Array as Arr } from "effect";
import type { ForumMessage } from "@/components/tenant/classes/forum/optimistic";

/** The summary of one discussion, as a channel and the discussion's page show it. */
type Discussion = NonNullable<ForumMessage["discussion"]>;

/**
 * The faces of a thread's repliers once `author` replied, as the server keeps them: the newest first, each once, at
 * most `REPLIER_LIMIT`.
 */
export const withReplier = (
  repliers: Discussion["repliers"],
  author: ForumMessage["author"]
) =>
  Arr.take(
    Arr.prepend(
      Arr.filter(repliers, (face) =>
        author.nina ? !face.nina : face.nina || face.id !== author.id
      ),
      author
    ),
    REPLIER_LIMIT
  );

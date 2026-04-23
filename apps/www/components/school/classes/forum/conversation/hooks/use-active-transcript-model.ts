import { useMemo } from "react";
import { createActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/active-transcript";

/** Memoized boundary between transcript data and the render/scroll engine. */
export function useActiveTranscriptModel(
  input: Parameters<typeof createActiveTranscriptModel>[0]
) {
  const { forum, posts, unreadCue } = input;

  return useMemo(
    () =>
      createActiveTranscriptModel({
        forum,
        posts,
        unreadCue,
      }),
    [forum, posts, unreadCue]
  );
}

"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { type RefObject, useLayoutEffect, useRef } from "react";
import type { ActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/transcript/active";
import type { ConversationRow } from "@/components/school/classes/forum/conversation/data/transcript/pages";
import type { ConversationView } from "@/components/school/classes/forum/conversation/data/view/model";

export interface TranscriptRefs {
  backStackRef: RefObject<ConversationView[]>;
  postIdsRef: RefObject<Id<"schoolClassForumPosts">[]>;
  rowsRef: RefObject<ConversationRow[]>;
}

/** Keeps scroll callback inputs current without making them render state. */
export function useTranscriptRefs({
  activeTranscript,
  backStack,
}: {
  activeTranscript: ActiveTranscriptModel;
  backStack: ConversationView[];
}) {
  const postIdsRef = useRef(activeTranscript.postIds);
  const backStackRef = useRef(backStack);
  const rowsRef = useRef(activeTranscript.rows);

  useLayoutEffect(() => {
    postIdsRef.current = activeTranscript.postIds;
    backStackRef.current = backStack;
    rowsRef.current = activeTranscript.rows;
  });

  return {
    backStackRef,
    postIdsRef,
    rowsRef,
  } satisfies TranscriptRefs;
}

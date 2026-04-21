import type { ForumConversationView } from "@/components/school/classes/forum/conversation/models";

export type PendingAnchor = Extract<ForumConversationView, { kind: "post" }>;

export interface BottomPinState {
  attempts: number;
  requestId: number | null;
}

export interface TranscriptMetrics {
  scrollHeight: number;
  scrollOffset: number;
  viewportHeight: number;
}

export type GetTranscriptMetrics = () => TranscriptMetrics;

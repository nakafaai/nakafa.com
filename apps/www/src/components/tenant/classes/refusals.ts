import type { ToastCopy } from "@repo/design-system/lib/toast/notify";
import { Option, Predicate, Record as Rec } from "effect";

/** The copy of a class action that failed with no refusal of its own, in the toast every School action uses. */
const ACTION_ERROR: ToastCopy = {
  description: "action-error.description",
  title: "action-error.title",
};

/** The copy of each refusal a class action can meet, by its tag, so the reader learns what to change. */
const REFUSAL_COPY: Readonly<Record<string, ToastCopy>> = {
  TaskClosed: {
    description: "classroom-refusal-task-closed.description",
    title: "classroom-refusal-task-closed.title",
  },
  TaskPointsFixed: {
    description: "classroom-refusal-points-fixed.description",
    title: "classroom-refusal-points-fixed.title",
  },
  ScoreOutOfRange: {
    description: "classroom-refusal-score-range.description",
    title: "classroom-refusal-score-range.title",
  },
  QuestionsUnready: {
    description: "classroom-refusal-questions-unready.description",
    title: "classroom-refusal-questions-unready.title",
  },
  ScheduleInvalid: {
    description: "school-refusal-schedule-invalid.description",
    title: "school-refusal-schedule-invalid.title",
  },
  PinLimit: {
    description: "classroom-refusal-pin-limit.description",
    title: "classroom-refusal-pin-limit.title",
  },
  ScheduledLimit: {
    description: "classroom-refusal-scheduled-limit.description",
    title: "classroom-refusal-scheduled-limit.title",
  },
  ScheduledPast: {
    description: "classroom-refusal-scheduled-past.description",
    title: "classroom-refusal-scheduled-past.title",
  },
  ChannelLimit: {
    description: "classroom-refusal-channel-limit.description",
    title: "classroom-refusal-channel-limit.title",
  },
  ChannelNameTaken: {
    description: "school-refusal-channel-name-taken.description",
    title: "school-refusal-channel-name-taken.title",
  },
  ChannelFixed: {
    description: "school-refusal-channel-fixed.description",
    title: "school-refusal-channel-fixed.title",
  },
  ChannelArchived: {
    description: "classroom-refusal-channel-archived.description",
    title: "classroom-refusal-channel-archived.title",
  },
  DiscussionsClosed: {
    description: "classroom-refusal-discussions-closed.description",
    title: "classroom-refusal-discussions-closed.title",
  },
  MentionRefused: {
    description: "classroom-refusal-mention.description",
    title: "classroom-refusal-mention.title",
  },
  MessageEmpty: {
    description: "classroom-refusal-message-empty.description",
    title: "classroom-refusal-message-empty.title",
  },
  MessageHidden: {
    description: "classroom-refusal-message-hidden.description",
    title: "classroom-refusal-message-hidden.title",
  },
  FileQuotaReached: {
    description: "forum-file-quota.description",
    title: "forum-file-quota.title",
  },
  FileTypeRefused: {
    description: "forum-file-type.description",
    title: "forum-file-type.title",
  },
  AttachmentRefused: {
    description: "classroom-refusal-attachment.description",
    title: "classroom-refusal-attachment.title",
  },
  UploadGone: {
    description: "classroom-refusal-attachment.description",
    title: "classroom-refusal-attachment.title",
  },
  UploadMissing: {
    description: "classroom-refusal-attachment.description",
    title: "classroom-refusal-attachment.title",
  },
  ReactionLimit: {
    description: "classroom-refusal-reaction-limit.description",
    title: "classroom-refusal-reaction-limit.title",
  },
  VoteRefused: {
    description: "classroom-refusal-vote.description",
    title: "classroom-refusal-vote.title",
  },
  FolderLimit: {
    description: "classroom-refusal-folder-limit.description",
    title: "classroom-refusal-folder-limit.title",
  },
  FolderCycle: {
    description: "classroom-refusal-folder-cycle.description",
    title: "classroom-refusal-folder-cycle.title",
  },
  FileSizeRefused: {
    description: "classroom-refusal-file-size.description",
    title: "classroom-refusal-file-size.title",
  },
};

/**
 * The copy of a failed class action: the refusal's own by its tag, or the generic copy for a call that did not complete
 * or a refusal no copy names.
 */
export const classRefusalCopy = (error: unknown): ToastCopy =>
  Predicate.hasProperty(error, "_tag") && Predicate.isString(error._tag)
    ? Option.getOrElse(Rec.get(REFUSAL_COPY, error._tag), () => ACTION_ERROR)
    : ACTION_ERROR;

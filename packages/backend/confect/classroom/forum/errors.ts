import { refusal } from "@repo/backend/confect/tenancy/errors";
import { Schema } from "effect";

/** Adding a channel to a class that already holds the most channels it can. */
export class ChannelLimit extends Schema.TaggedError<ChannelLimit>()(
  "ChannelLimit",
  refusal("CHANNEL_LIMIT", "This class holds the most channels it can.")
) {}

/** A name that another channel of the same class already has, compared without case. */
export class ChannelNameTaken extends Schema.TaggedError<ChannelNameTaken>()(
  "ChannelNameTaken",
  refusal("CHANNEL_NAME_TAKEN", "Another channel of this class has this name.")
) {}

/** A rename, an archive or a removal of a class's general channel, whose name the page translates for each reader. */
export class ChannelFixed extends Schema.TaggedError<ChannelFixed>()(
  "ChannelFixed",
  refusal("CHANNEL_FIXED", "The general channel keeps its name.")
) {}

/** A write into an archived channel, which stays readable and takes nothing new. */
export class ChannelArchived extends Schema.TaggedError<ChannelArchived>()(
  "ChannelArchived",
  refusal("CHANNEL_ARCHIVED", "This channel is archived.")
) {}

/** An edit of a message that a teacher hid: the message has no text left to change. */
export class MessageHidden extends Schema.TaggedError<MessageHidden>()(
  "MessageHidden",
  refusal("MESSAGE_HIDDEN", "A teacher hid this message.")
) {}

/** A student opening a discussion while the school keeps discussions to teachers (`studentThreads` off). */
export class DiscussionsClosed extends Schema.TaggedError<DiscussionsClosed>()(
  "DiscussionsClosed",
  refusal(
    "DISCUSSIONS_CLOSED",
    "Only teachers open discussions in this school."
  )
) {}

/** A mention of someone who does not write in the class, or of everyone by a member who is not its subject teacher. */
export class MentionRefused extends Schema.TaggedError<MentionRefused>()(
  "MentionRefused",
  refusal("MENTION_REFUSED", "This message mentions someone it may not.")
) {}

/** A message with no text, no file and no poll. */
export class MessageEmpty extends Schema.TaggedError<MessageEmpty>()(
  "MessageEmpty",
  refusal("MESSAGE_EMPTY", "Write something or add a file first.")
) {}

/** An upload that is not the sender's own, or that is already gone. */
export class UploadGone extends Schema.TaggedError<UploadGone>()(
  "UploadGone",
  refusal("UPLOAD_GONE", "This file is no longer here. Add it again.")
) {}

/** A file that would pass the bytes a school's forum holds. The file is deleted. */
export class FileQuotaReached extends Schema.TaggedError<FileQuotaReached>()(
  "FileQuotaReached",
  refusal(
    "FILE_QUOTA_REACHED",
    "This school's chats hold all the files they can."
  )
) {}

/** A file whose bytes name no image, PDF or office document. The file is deleted. */
export class AttachmentRefused extends Schema.TaggedError<AttachmentRefused>()(
  "AttachmentRefused",
  refusal(
    "ATTACHMENT_REFUSED",
    "Only a photo, a PDF, or a Word, Excel or PowerPoint file can be sent."
  )
) {}

/** Another emoji on a message that already carries the most it can. */
export class ReactionLimit extends Schema.TaggedError<ReactionLimit>()(
  "ReactionLimit",
  refusal("REACTION_LIMIT", "This message carries the most emoji it can.")
) {}

/** A vote that names a choice the poll does not hold, or several in a poll of one choice. */
export class VoteRefused extends Schema.TaggedError<VoteRefused>()(
  "VoteRefused",
  refusal("VOTE_REFUSED", "This poll does not take that vote.")
) {}

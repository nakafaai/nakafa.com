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

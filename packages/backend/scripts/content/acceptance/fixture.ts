import { Schema } from "effect";

/**
 * The school that a browser test opens: its address and its name. The local
 * acceptance runtime writes it, and the browser test reads it back.
 */
export const SchoolFixture = Schema.fromJsonString(
  Schema.Struct({ name: Schema.String, slug: Schema.String })
);

/**
 * The login card that a browser test redeems: the school login name that the student types, and
 * the plain code of the card. The local acceptance runtime writes it, and the browser test reads
 * it back.
 */
export const CardFixture = Schema.fromJsonString(
  Schema.Struct({ code: Schema.String, loginName: Schema.String })
);

/**
 * The plain sign-in code of a parent whose address the school linked. The local acceptance
 * runtime writes it in place of the mail, and the browser test reads it back.
 */
export const GuardianFixture = Schema.fromJsonString(
  Schema.Struct({ code: Schema.String })
);

/**
 * The sitting that a browser test enters: its exam, the sitting, and the sitting's token. The
 * local acceptance runtime writes it, and the browser test reads it back.
 */
export const SittingFixture = Schema.fromJsonString(
  Schema.Struct({
    examId: Schema.String,
    sittingId: Schema.String,
    title: Schema.String,
    token: Schema.String,
  })
);

/**
 * The history of a class's general channel that a browser test reads: the channel, the class,
 * and the seeded messages, oldest first. The local acceptance runtime writes it, and the browser
 * test reads it back.
 */
export const ForumFixture = Schema.fromJsonString(
  Schema.Struct({
    channelId: Schema.String,
    classId: Schema.String,
    messages: Schema.Array(Schema.String),
  })
);

/**
 * The session cookie of an account that the local acceptance runtime signed in.
 * The runtime writes it, and the browser test reads it back before it sends it.
 */
export const SessionCookie = Schema.fromJsonString(
  Schema.Struct({ name: Schema.String, value: Schema.String })
);

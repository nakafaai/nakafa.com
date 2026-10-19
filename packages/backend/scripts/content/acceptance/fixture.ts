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
 * The sitting that a browser test enters: its exam, the sitting, and the sitting's token. The
 * local acceptance runtime writes it, and the browser test reads it back.
 */
export const SittingFixture = Schema.fromJsonString(
  Schema.Struct({
    examId: Schema.String,
    sittingId: Schema.String,
    token: Schema.String,
  })
);

/**
 * The session cookie of an account that the local acceptance runtime signed in.
 * The runtime writes it, and the browser test reads it back before it sends it.
 */
export const SessionCookie = Schema.fromJsonString(
  Schema.Struct({ name: Schema.String, value: Schema.String })
);

import { Effect, FileSystem, Schema } from "effect";

/** The school that a browser test opens: its address and its name. */
export const SchoolFixture = Schema.Struct({
  name: Schema.String,
  slug: Schema.String,
});

/**
 * The login card that a browser test redeems: the school login name that the
 * student types, and the plain code of the card.
 */
export const CardFixture = Schema.Struct({
  code: Schema.String,
  loginName: Schema.String,
});

/** The sitting that a browser test enters: its exam, the sitting, and the sitting's token. */
export const SittingFixture = Schema.Struct({
  examId: Schema.String,
  sittingId: Schema.String,
  title: Schema.String,
  token: Schema.String,
});

/** The graduating class group that a browser test opens: its ID and its name. */
export const GraduationFixture = Schema.Struct({
  cohort: Schema.String,
  cohortId: Schema.String,
});

/**
 * The history of a class's general channel that a browser test reads: the
 * channel, the class, and the seeded messages, oldest first.
 */
export const ForumFixture = Schema.Struct({
  channelId: Schema.String,
  classId: Schema.String,
  messages: Schema.Array(Schema.String),
});

/** The session cookies of an account that the local runtime signed in, for a browser to send. */
export const SessionCookies = Schema.Array(
  Schema.Struct({
    name: Schema.String,
    value: Schema.String,
  })
);

/**
 * Writes one fixture to `output` as JSON, mode 600, for a person or a script
 * that asked the command line for it. A file that already stands is refused, so
 * a fixture never replaces another one.
 */
export const writeFixture = Effect.fn("contentAcceptance.writeFixture")(
  function* <A, I>(output: string, schema: Schema.Codec<A, I>, value: A) {
    const text = yield* Schema.encodeEffect(Schema.fromJsonString(schema))(
      value
    );
    yield* (yield* FileSystem.FileSystem).writeFileString(output, text, {
      flag: "wx",
      mode: 0o600,
    });
  }
);

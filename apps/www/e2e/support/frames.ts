import { Array as Arr, Schema } from "effect";

/** What a mutation and an action share: the function they call, and the `requestId` the server answers with. */
const callFields = {
  args: Schema.Array(Schema.Unknown),
  requestId: Schema.Finite,
  udfPath: Schema.String,
};

/** A change the page sends, which the server answers with the same `requestId`. */
const MutationSchema = Schema.Struct({
  ...callFields,
  type: Schema.Literal("Mutation"),
});

/**
 * An action the page asks the server to run, such as an upload. It can write
 * as a mutation does, so it is a change too.
 */
const ActionSchema = Schema.Struct({
  ...callFields,
  type: Schema.Literal("Action"),
});

/** The answer of a server that could not take a change, as the protocol words it. */
const RefusalSchema = Schema.Struct({
  logLines: Schema.Array(Schema.String),
  requestId: Schema.Finite,
  result: Schema.String,
  success: Schema.Literal(false),
  type: Schema.Literal("MutationResponse"),
});

/** The frames the page sends that a step waits on. Any other frame decodes to none. */
export const SentSchema = Schema.Union([
  Schema.Struct({
    tokenType: Schema.Literal("User"),
    type: Schema.Literal("Authenticate"),
  }),
  MutationSchema,
  ActionSchema,
  Schema.Struct({
    modifications: Schema.Array(
      Schema.Struct({
        queryId: Schema.Finite,
        type: Schema.String,
        udfPath: Schema.optionalKey(Schema.String),
      })
    ),
    type: Schema.Literal("ModifyQuerySet"),
  }),
]);

/**
 * The frames the server sends that a step waits on. A `ts` is a moment of the
 * database, which the protocol writes as eight bytes in Base64.
 */
export const GivenSchema = Schema.Union([
  Schema.Struct({
    requestId: Schema.Finite,
    success: Schema.Boolean,
    ts: Schema.optionalKey(Schema.Uint8ArrayFromBase64),
    type: Schema.Literal("MutationResponse"),
  }),
  Schema.Struct({ type: Schema.Literal("ActionResponse") }),
  Schema.Struct({
    endVersion: Schema.Struct({ ts: Schema.Uint8ArrayFromBase64 }),
    modifications: Schema.Array(
      Schema.Struct({
        queryId: Schema.Finite,
        type: Schema.String,
        /** What an updated query now answers. */
        value: Schema.optionalKey(Schema.Unknown),
      })
    ),
    type: Schema.Literal("Transition"),
  }),
]);

export const decodeSent = Schema.decodeOption(
  Schema.fromJsonString(SentSchema)
);
export const decodeGiven = Schema.decodeOption(
  Schema.fromJsonString(GivenSchema)
);
export const encodeRefusal = Schema.encodeSync(
  Schema.fromJsonString(RefusalSchema)
);
export const isMutation = Schema.is(MutationSchema);

/** The moment of the database that a `ts` names: eight bytes, the least significant first. */
export const momentOf = (bytes: Uint8Array) =>
  Arr.reduceRight(
    Arr.fromIterable(bytes),
    0n,
    (moment, byte) => moment * 256n + BigInt(byte)
  );

/** The later of two moments. */
export const later = (one: bigint, other: bigint) =>
  one > other ? one : other;

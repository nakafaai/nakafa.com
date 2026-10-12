import { Array as Arr, Schema } from "effect";

/** The realtime connection of the page to the backend. */
export const CONVEX_SOCKET = /\/api\/[^/]+\/sync/;

/** A change the page sends, which the server answers with the same `requestId`. */
const MutationSchema = Schema.Struct({
  args: Schema.Array(Schema.Unknown),
  requestId: Schema.Finite,
  type: Schema.Literal("Mutation"),
  udfPath: Schema.String,
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
 * A frame from the server that tells the page what some queries now answer. A
 * change of the kind `QueryUpdated` carries the new answer as its `value`. A
 * decoded frame keeps only the fields described here.
 */
const TransitionSchema = Schema.Struct({
  modifications: Schema.Array(
    Schema.Struct({
      queryId: Schema.Finite,
      type: Schema.String,
      value: Schema.optionalKey(Schema.Unknown),
    })
  ),
  type: Schema.Literal("Transition"),
});

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
  Schema.Struct({
    ...TransitionSchema.fields,
    endVersion: Schema.Struct({ ts: Schema.Uint8ArrayFromBase64 }),
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
export const isTransition = Schema.is(TransitionSchema);

/**
 * Reads a frame as plain JSON and writes it back. A step that changes one part
 * of a frame and sends the rest on as it came uses these, because a decoded
 * frame keeps only the fields a Schema describes.
 */
export const decodeFrame = Schema.decodeOption(
  Schema.fromJsonString(Schema.Unknown)
);
export const encodeFrame = Schema.encodeSync(
  Schema.fromJsonString(Schema.Unknown)
);

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

import { Array as Arr, Schema } from "effect";

/** A change the page sends, which the server answers with the same `requestId`. */
const MutationSchema = Schema.Struct({
  args: Schema.Array(Schema.Unknown),
  requestId: Schema.Finite,
  type: Schema.Literal("Mutation"),
  udfPath: Schema.String,
});

/** A call to an action, which the server answers with an `ActionResponse`. */
const ActionSchema = Schema.Struct({
  args: Schema.Array(Schema.Unknown),
  requestId: Schema.Finite,
  type: Schema.Literal("Action"),
  udfPath: Schema.String,
});

/**
 * The answer of a server that could not take a change or an action, as the
 * protocol words it. `errorData` is what a typed failure of the function
 * carries, such as the encoded error of a Confect function.
 */
const RefusalSchema = Schema.Struct({
  errorData: Schema.optionalKey(Schema.Unknown),
  logLines: Schema.Array(Schema.String),
  requestId: Schema.Finite,
  result: Schema.String,
  success: Schema.Literal(false),
  type: Schema.Literals(["MutationResponse", "ActionResponse"]),
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
  Schema.Struct({
    endVersion: Schema.Struct({ ts: Schema.Uint8ArrayFromBase64 }),
    modifications: Schema.Array(
      Schema.Struct({ queryId: Schema.Finite, type: Schema.String })
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
/** A change the page sends, which the server answers with a `MutationResponse`. */
export const isMutation = Schema.is(MutationSchema);
/** A call the server answers: a change or an action. */
export const isCall = Schema.is(Schema.Union([MutationSchema, ActionSchema]));

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

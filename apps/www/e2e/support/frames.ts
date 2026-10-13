import { Array as Arr, Option, Schema } from "effect";

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

/**
 * A transition with every field it carries kept, so a step can change one
 * update and send the rest as the server wrote it.
 */
const TransitionSchema = Schema.StructWithRest(
  Schema.Struct({
    modifications: Schema.Array(
      Schema.StructWithRest(
        Schema.Struct({ queryId: Schema.Finite, type: Schema.String }),
        [Schema.Record(Schema.String, Schema.Unknown)]
      )
    ),
    type: Schema.Literal("Transition"),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)]
);
const decodeTransition = Schema.decodeOption(
  Schema.fromJsonString(TransitionSchema)
);
const encodeTransition = Schema.encodeSync(
  Schema.fromJsonString(TransitionSchema)
);

/**
 * The transition `text` with the answers to the queries `queryIds` turned into
 * the failure a server sends when the function throws: `data` is what the page
 * decodes as the typed failure of the function. None when the transition
 * updates none of those queries.
 */
export const failQueriesIn = (
  text: string,
  queryIds: readonly number[],
  data: unknown
) => {
  const answersQuery = (update: { queryId: number; type: string }) =>
    update.type === "QueryUpdated" && Arr.contains(queryIds, update.queryId);

  return decodeTransition(text).pipe(
    Option.filter((transition) =>
      Arr.some(transition.modifications, answersQuery)
    ),
    Option.map((transition) =>
      encodeTransition({
        ...transition,
        modifications: Arr.map(transition.modifications, (update) =>
          answersQuery(update)
            ? {
                errorData: data,
                errorMessage: "Refused by the test",
                journal: update.journal,
                logLines: [],
                queryId: update.queryId,
                type: "QueryFailed",
              }
            : update
        ),
      })
    )
  );
};

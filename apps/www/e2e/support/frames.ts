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
        /** What an added query is called with: one record of arguments. */
        args: Schema.optionalKey(Schema.Array(Schema.Unknown)),
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

/** What a transition says about one query, with every field the server wrote. */
type Update = (typeof TransitionSchema.Type)["modifications"][number];

/**
 * The transition `text` with each update that `replace` gives another one put
 * in its place, and every other field kept as the server wrote it. None when
 * `replace` gives none, and for a frame that is no transition.
 */
const replaceUpdatesIn = (
  text: string,
  replace: (update: Update) => Option.Option<Update>
) =>
  decodeTransition(text).pipe(
    Option.flatMap((transition) => {
      const replacements = Arr.map(transition.modifications, (update) =>
        replace(update)
      );
      if (!Arr.some(replacements, Option.isSome)) {
        return Option.none();
      }
      return Option.some(
        encodeTransition({
          ...transition,
          modifications: Arr.zipWith(
            transition.modifications,
            replacements,
            (update, replacement) => Option.getOrElse(replacement, () => update)
          ),
        })
      );
    })
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
) =>
  replaceUpdatesIn(text, (update) =>
    update.type === "QueryUpdated" && Arr.contains(queryIds, update.queryId)
      ? Option.some({
          errorData: data,
          errorMessage: "Refused by the test",
          journal: update.journal,
          logLines: [],
          queryId: update.queryId,
          type: "QueryFailed",
        })
      : Option.none()
  );

/**
 * The transition `text` with what the server said of each query that
 * `valueFor` knows turned into the update of a function that returned that
 * value, whatever the server said. None when the transition says nothing of
 * those queries.
 */
export const answerQueriesIn = (
  text: string,
  valueFor: (queryId: number) => Option.Option<unknown>
) =>
  replaceUpdatesIn(text, (update) =>
    Option.map(valueFor(update.queryId), (value) => ({
      journal: null,
      logLines: [],
      queryId: update.queryId,
      type: "QueryUpdated",
      value,
    }))
  );

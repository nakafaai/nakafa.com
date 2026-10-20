import { Effect, Schema } from "effect";

/**
 * The catalog query of a track page: its status filter, sort and direction. A
 * value that does not decode reads as none, so a stale link still opens the track.
 */
export const TryoutTrackSearchFields = Schema.Struct({
  direction: Schema.optional(Schema.String),
  sort: Schema.optional(Schema.String),
  status: Schema.optional(Schema.String),
});

export const TryoutTrackSearch = TryoutTrackSearchFields.pipe(
  Schema.catchDecoding(() => Effect.succeedSome({}))
);

export type TryoutTrackSearch = typeof TryoutTrackSearch.Type;

/** A query value that a learner's link may repeat, which the readers then refuse. */
const QueryValue = Schema.Union([Schema.String, Schema.Array(Schema.String)]);

/**
 * The address of an attempt page: its attempt capability and its player view.
 * Both stay raw here, because a page refuses an invalid value with not found, as
 * the attempt readers decide it.
 */
export const TryoutAttemptSearch = Schema.Struct({
  attemptId: Schema.optional(QueryValue),
  view: Schema.optional(QueryValue),
});

export type TryoutAttemptSearch = typeof TryoutAttemptSearch.Type;

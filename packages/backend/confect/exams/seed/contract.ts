import { Schema } from "effect";

/** What a seated Person does in the load test: a student sits the exam, a proctor watches a room. */
export const SeatKind = Schema.Literals(["student", "proctor"]);

/**
 * One seat of the load test as the test names it: the key of its placeholder address, the
 * name its account takes, and the session token the test signs its cookie with.
 */
export const Seat = Schema.Struct({
  key: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  token: Schema.NonEmptyString,
});

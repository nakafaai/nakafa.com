import { Schema } from "effect";

/**
 * What a page may know about its visitor. It is loader data and reaches the
 * browser, so it never holds a credential: the Convex token stays on the server.
 */
export const ClientSession = Schema.TaggedUnion({
  SignedIn: {
    name: Schema.String,
    sessionId: Schema.String,
    userId: Schema.String,
  },
  SignedOut: {},
});

export type ClientSession = typeof ClientSession.Type;

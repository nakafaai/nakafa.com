import { Schema } from "effect";

/** The Better Auth session of the session route, or null for a visitor. */
export const SessionJson = Schema.fromJsonString(
  Schema.NullOr(
    Schema.Struct({
      session: Schema.Struct({ id: Schema.String }),
      user: Schema.Struct({ id: Schema.String, name: Schema.String }),
    })
  )
);

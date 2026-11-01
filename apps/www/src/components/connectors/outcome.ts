import type { GoogleConnector } from "@repo/backend/confect/connectors/google/manifest";
import { ConnectOutcome } from "@repo/backend/confect/connectors/schema";
import { Option, Schema } from "effect";

/** What the connect callback appends when the browser comes back: how a connect ended, and whose. */
export const ConnectSearch = Schema.Struct({
  connect: Schema.optionalKey(ConnectOutcome.fields.outcome),
  connector: Schema.optionalKey(ConnectOutcome.fields.connector),
});

/** How the last connect of `connector` ended badly, for its card alone. Any other outcome is nothing to say. */
export const connectFailure = (
  { connect, connector }: typeof ConnectSearch.Type,
  shown: GoogleConnector
) =>
  connector === shown && (connect === "failed" || connect === "refused")
    ? Option.some(connect)
    : Option.none();

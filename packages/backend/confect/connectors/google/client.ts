import { ConnectorOff } from "@repo/backend/confect/connectors/errors";
import { GoogleConnector } from "@repo/backend/confect/connectors/google/manifest";
import { Array as Arr, Config, Effect, Option, Schema } from "effect";

/**
 * The Google connectors this deployment offers, from `GOOGLE_CONNECTORS`: their
 * names, separated by commas. An unset or empty list offers none, which is how
 * production stays off until Google's review of a connector's scopes passes. A
 * name that is no Google connector is left out.
 */
export const readOfferedConnectors = Effect.fn("connectors.google.offered")(
  function* () {
    const listed = yield* Config.option(
      Config.String("GOOGLE_CONNECTORS")
    ).pipe(Effect.orDie);
    return Option.match(listed, {
      onNone: () => [],
      onSome: (text) =>
        Arr.dedupe(
          Arr.filterMap(text.split(","), (name) =>
            Schema.decodeUnknownResult(GoogleConnector)(name.trim())
          )
        ),
    });
  }
);

/**
 * The OAuth client of the connectors project, for a connector this deployment
 * offers. A connector that is not offered, or a deployment without the client's
 * ID or secret, fails with `ConnectorOff`, so nothing reaches Google.
 */
export const readGoogleClient = Effect.fn("connectors.google.client")(
  function* (connector: GoogleConnector) {
    const offered = yield* readOfferedConnectors();
    if (!Arr.contains(offered, connector)) {
      return yield* new ConnectorOff();
    }
    return yield* Config.all({
      id: Config.String("GOOGLE_CONNECTOR_CLIENT_ID"),
      secret: Config.Redacted("GOOGLE_CONNECTOR_CLIENT_SECRET"),
    }).pipe(Effect.mapError(() => new ConnectorOff()));
  }
);

import { ConnectorOff } from "@repo/backend/confect/connectors/errors";
import { GoogleConnector } from "@repo/backend/confect/connectors/google/manifest";
import {
  Array as Arr,
  Config,
  Effect,
  Option,
  Schema,
  String as Str,
} from "effect";

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

/**
 * What Google's Picker needs beside the user's token: the browser key of the
 * connectors project, from `GOOGLE_PICKER_API_KEY`, and the project's number,
 * which leads the client's ID and lets the Picker grant a picked file to the
 * client. A deployment that does not offer Drive, or has no key, fails with
 * `ConnectorOff`.
 */
export const readPickerKeys = Effect.fn("connectors.google.pickerKeys")(
  function* () {
    const client = yield* readGoogleClient("drive");
    const apiKey = yield* Config.String("GOOGLE_PICKER_API_KEY").pipe(
      Effect.mapError(() => new ConnectorOff())
    );
    return { apiKey, appId: Arr.headNonEmpty(Str.split(client.id, "-")) };
  }
);

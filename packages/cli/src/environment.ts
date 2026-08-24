import { Config, ConfigProvider, Effect, Option } from "effect";

const ApiEdgeSecretConfig = Config.nonEmptyString(
  "NAKAFA_API_EDGE_SECRET"
).pipe(Config.option);

/** Reads optional isolated-origin authentication from the active environment. */
export const readCliEnvironment = Effect.fn("nakafaCli.readEnvironment")(
  function* () {
    const provider = yield* ConfigProvider.ConfigProvider;
    const apiEdgeSecret = yield* ApiEdgeSecretConfig.parse(provider);
    return { apiEdgeSecret: Option.getOrUndefined(apiEdgeSecret) };
  }
);

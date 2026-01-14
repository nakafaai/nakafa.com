import { Context, Data, Effect, Layer } from "effect";

class MissingAuthHeader extends Data.TaggedError("MissingAuthHeader")<{
  readonly message: "Missing Authorization header";
  readonly status: 401;
}> {}

class InvalidAuthFormat extends Data.TaggedError("InvalidAuthFormat")<{
  readonly message: "Expected format: Authorization: Bearer <key>";
  readonly status: 401;
}> {}

class InvalidApiKey extends Data.TaggedError("InvalidApiKey")<{
  readonly message: "Invalid internal API key";
  readonly status: 401;
}> {}

class InternalKeyNotConfigured extends Data.TaggedError(
  "InternalKeyNotConfigured"
)<{
  readonly message: "Internal API key not configured";
  readonly status: 500;
}> {}

type AuthError =
  | MissingAuthHeader
  | InvalidAuthFormat
  | InvalidApiKey
  | InternalKeyNotConfigured;

class InternalAuthService extends Context.Tag("InternalAuthService")<
  InternalAuthService,
  {
    readonly getInternalKey: Effect.Effect<string, InternalKeyNotConfigured>;
  }
>() {}

export function timingSafeEqual(
  a: string | undefined,
  b: string | undefined
): Effect.Effect<boolean, never> {
  return Effect.sync(() => {
    if (a === undefined || b === undefined) {
      return false;
    }

    if (a.length !== b.length) {
      return false;
    }

    const encoder = new TextEncoder();
    const aBuffer = encoder.encode(a);
    const bBuffer = encoder.encode(b);

    let result = 0;
    for (let i = 0; i < aBuffer.length; i++) {
      result += aBuffer[i] !== bBuffer[i] ? 1 : 0;
    }

    return result === 0;
  });
}

export function requireInternalApiKey(
  req: Request
): Effect.Effect<void, AuthError, InternalAuthService> {
  return Effect.gen(function* () {
    const service = yield* InternalAuthService;

    const authHeader = req.headers.get("Authorization");

    const header = yield* Effect.flatMap(
      Effect.sync(() => authHeader),
      (value) =>
        value === null || value === undefined
          ? Effect.fail(
              new MissingAuthHeader({
                message: "Missing Authorization header",
                status: 401,
              })
            )
          : Effect.succeed(value)
    );

    const [prefix, key] = header.split(" ");

    if (prefix !== "Bearer") {
      yield* Effect.fail(
        new InvalidAuthFormat({
          message: "Expected format: Authorization: Bearer <key>",
          status: 401,
        })
      );
    }

    const internalApiKey = yield* service.getInternalKey;

    const isValid = yield* timingSafeEqual(key, internalApiKey);

    if (!isValid) {
      yield* Effect.fail(
        new InvalidApiKey({
          message: "Invalid internal API key",
          status: 401,
        })
      );
    }
  });
}

/**
 * Creates a live layer for InternalAuthService with a specific API key.
 * Production code uses this with validated env.INTERNAL_CONTENT_API_KEY.
 * For testing, pass undefined to simulate missing configuration.
 *
 * @param apiKey - The internal API key to use, or undefined
 * @returns A Layer that provides InternalAuthService with given key
 */
export function createAuthLayer(
  apiKey?: string
): Layer.Layer<InternalAuthService> {
  return Layer.effect(
    InternalAuthService,
    Effect.succeed({
      getInternalKey:
        apiKey === undefined
          ? Effect.fail(
              new InternalKeyNotConfigured({
                message: "Internal API key not configured",
                status: 500,
              })
            )
          : Effect.succeed(apiKey),
    })
  );
}

import { Context, Effect, Layer, Option, Schema } from "effect";

const SECONDS_PER_YEAR = 60 * 60 * 24 * 365;

/** How the player lays out questions: all at once, or one at a time. */
export const PlayerModeSchema = Schema.Literals(["list", "single"]);

/** Schema-derived player view mode. */
export type PlayerMode = typeof PlayerModeSchema.Type;

/** Search parameter that carries the view, so reloads render the same mode. */
export const PLAYER_MODE_PARAM = "view";

/** Cookie that remembers the learner's last chosen view across sections. */
export const PLAYER_MODE_COOKIE = "player_view";

/** Classified view search parameter of one server request. */
export type PlayerModeParam =
  | { readonly kind: "absent" }
  | { readonly kind: "invalid" }
  | { readonly kind: "valid"; readonly mode: PlayerMode };

const decodeMode = Schema.decodeUnknownOption(PlayerModeSchema);

/** Classifies the optional view; a repeated or unknown value is invalid. */
export function readPlayerModeParam(
  searchParams: Readonly<Record<string, string | string[] | undefined>>
): PlayerModeParam {
  const value = searchParams[PLAYER_MODE_PARAM];
  if (value === undefined) {
    return { kind: "absent" };
  }
  return Option.match(decodeMode(value), {
    onNone: () => ({ kind: "invalid" }),
    onSome: (mode) => ({ kind: "valid", mode }),
  });
}

/** Reads the remembered view; a value outside the schema counts as absent. */
export function readPlayerModeCookie(value: string | undefined) {
  return decodeMode(value);
}

/** Picks the view to render: a lock wins, then the URL, then the cookie. */
export function resolvePlayerMode(input: {
  readonly cookie: Option.Option<PlayerMode>;
  readonly lock: PlayerMode | null;
  readonly param: PlayerModeParam;
}): PlayerMode {
  if (input.lock) {
    return input.lock;
  }
  if (input.param.kind === "valid") {
    return input.param.mode;
  }
  return Option.getOrElse(input.cookie, () => "list");
}

/** Expected browser failure while remembering the chosen view. */
export class PlayerModePersistenceError extends Schema.TaggedError<PlayerModePersistenceError>()(
  "PlayerModePersistenceError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Browser seam that stores the view cookie and the view search parameter. */
export class PlayerModeWriter extends Context.Service<
  PlayerModeWriter,
  {
    /** Writes the serialized cookie and replaces the URL's view parameter. */
    readonly write: (input: {
      readonly cookie: string;
      readonly mode: PlayerMode;
    }) => Effect.Effect<void, PlayerModePersistenceError>;
  }
>()("@/components/player/PlayerModeWriter") {}

const writeBrowserMode = Effect.fn("player.mode.writeBrowser")(
  function* (input: { readonly cookie: string; readonly mode: PlayerMode }) {
    yield* Effect.try({
      try: () => {
        // biome-ignore lint/suspicious/noDocumentCookie: this is the browser persistence boundary owned by the player view
        document.cookie = input.cookie;
        const url = new URL(window.location.href);
        url.searchParams.set(PLAYER_MODE_PARAM, input.mode);
        window.history.replaceState(null, "", url);
      },
      catch: (cause) =>
        new PlayerModePersistenceError({
          cause,
          message: "Failed to remember the player view.",
        }),
    });
  }
);

/** Live browser implementation; Next.js syncs its router with replaceState. */
export const BrowserPlayerModeWriterLive = Layer.succeed(PlayerModeWriter, {
  write: writeBrowserMode,
});

/** Remembers one chosen view for the next server render. */
export const persistPlayerMode = Effect.fn("player.mode.persist")(function* (
  mode: PlayerMode
) {
  const writer = yield* PlayerModeWriter;
  yield* writer.write({
    cookie: `${PLAYER_MODE_COOKIE}=${mode}; path=/; max-age=${SECONDS_PER_YEAR}; samesite=lax`,
    mode,
  });
});

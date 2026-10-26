import { Config, Effect, FileSystem, Option, Path, Schema } from "effect";
import { SchoolError } from "#cli/error";

/** One school sign-in of the CLI: the school's host, its access token, and when the token expires. */
export const SchoolSession = Schema.Struct({
  expiresAt: Schema.Finite,
  host: Schema.String,
  token: Schema.String,
});

/** The JSON text of a stored sign-in. */
const SessionJson = Schema.fromJsonString(SchoolSession);

/** Only the owner of the file may read or write it, because it holds a bearer token. */
const OWNER_ONLY = 0o600;

/**
 * The file that holds the sign-in: `school.json` in the `nakafa` folder of the user's
 * configuration directory, `XDG_CONFIG_HOME` when it is set, else `~/.config`.
 */
const sessionPath = Effect.fn("NakafaCli.credentials.path")(function* () {
  const path = yield* Path.Path;
  const xdg = yield* Config.option(Config.string("XDG_CONFIG_HOME"));
  const base = Option.isSome(xdg)
    ? xdg.value
    : path.join(yield* Config.string("HOME"), ".config");
  return path.join(base, "nakafa", "school.json");
});

/** The refusal of a sign-in file the CLI cannot write or remove. */
const unwritable = () =>
  new SchoolError({
    code: "CREDENTIALS_UNWRITABLE",
    message:
      "The sign-in file cannot be written. Check the configuration directory.",
  });

/** Stores one sign-in, readable by its owner only. */
export const storeSession = Effect.fn("NakafaCli.credentials.store")(function* (
  session: typeof SchoolSession.Type
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = yield* sessionPath();
  yield* fileSystem.makeDirectory(path.dirname(file), { recursive: true });
  yield* fileSystem.writeFileString(
    file,
    yield* Schema.encodeEffect(SessionJson)(session)
  );
  yield* fileSystem.chmod(file, OWNER_ONLY);
  return file;
}, Effect.mapError(unwritable));

/** The stored sign-in, refused as `NOT_SIGNED_IN` when there is none and `SIGN_IN_EXPIRED` once its token expired. */
export const readSession = Effect.fn("NakafaCli.credentials.read")(function* (
  now: number
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const file = yield* sessionPath();
  const text = yield* fileSystem.readFileString(file).pipe(
    Effect.mapError(
      () =>
        new SchoolError({
          code: "NOT_SIGNED_IN",
          message: "Sign in first with `nakafa school login <school host>`.",
        })
    )
  );
  const session = yield* Schema.decodeEffect(SessionJson)(text).pipe(
    Effect.mapError(
      () =>
        new SchoolError({
          code: "NOT_SIGNED_IN",
          message: "The stored sign-in is unreadable. Sign in again.",
        })
    )
  );
  if (session.expiresAt <= now) {
    return yield* new SchoolError({
      code: "SIGN_IN_EXPIRED",
      message: "The sign-in expired. Sign in again.",
    });
  }
  return session;
});

/** Removes the stored sign-in, if there is one. */
export const removeSession = Effect.fn("NakafaCli.credentials.remove")(
  function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    yield* fileSystem.remove(yield* sessionPath(), { force: true });
  },
  Effect.mapError(unwritable)
);

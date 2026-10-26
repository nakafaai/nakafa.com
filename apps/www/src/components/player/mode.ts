import { readCookie } from "@repo/internationalization/src/cookie";
import { Duration, Option, Schema } from "effect";

/** How the player lays out questions: all in one list, or one at a time. */
export const PlayerModeSchema = Schema.Literals(["list", "single"]);

/** Schema-derived player view mode. */
export type PlayerMode = typeof PlayerModeSchema.Type;

/** Search parameter that names the view and wins over the saved preference. */
export const PLAYER_MODE_PARAM = "view";

/** Cookie that keeps the view a learner chose for their next page. */
export const PLAYER_MODE_COOKIE = "player_view";

/** How long the saved view lasts. */
export const PLAYER_MODE_MAX_AGE = Duration.toSeconds(Duration.days(365));

/** Reads a view from any value: the view when it is one, otherwise none. */
export const decodePlayerMode = Schema.decodeUnknownOption(PlayerModeSchema);

/** The view search parameter of one request: missing, unknown, or a view. */
const PlayerModeParamSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("absent") }),
  Schema.Struct({ kind: Schema.Literal("invalid") }),
  Schema.Struct({ kind: Schema.Literal("valid"), mode: PlayerModeSchema }),
]);

/** Classified view search parameter of one server request. */
export type PlayerModeParam = typeof PlayerModeParamSchema.Type;

/** Classifies the optional view parameter; a repeated or unknown value is invalid. */
export function readPlayerModeParam(
  searchParams: Readonly<Record<string, string | readonly string[] | undefined>>
): PlayerModeParam {
  const value = searchParams[PLAYER_MODE_PARAM];
  if (value === undefined) {
    return { kind: "absent" };
  }
  return Option.match(decodePlayerMode(value), {
    onNone: () => ({ kind: "invalid" }),
    onSome: (mode) => ({ kind: "valid", mode }),
  });
}

/** Picks the view to render: the address first, then the saved view, then the list. */
export function resolvePlayerMode(input: {
  cookie: Option.Option<PlayerMode>;
  param: PlayerModeParam;
}): PlayerMode {
  if (input.param.kind === "valid") {
    return input.param.mode;
  }
  return Option.getOrElse(input.cookie, () => "list");
}

/**
 * Resolves the view in the browser, for a page that renders only there, such as a
 * school sitting: the address first, then the view the learner saved, then the list.
 */
export function readBrowserPlayerMode(param: PlayerModeParam): PlayerMode {
  const cookie = readCookie(
    new Headers({ cookie: document.cookie }),
    PLAYER_MODE_COOKIE
  );
  return resolvePlayerMode({
    cookie: Option.flatMap(cookie, decodePlayerMode),
    param,
  });
}

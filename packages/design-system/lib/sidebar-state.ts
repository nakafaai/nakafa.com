import { Context, Effect, Layer, Schema } from "effect";

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;

/** Default cookie key used to persist the sidebar's expanded state. */
export const SIDEBAR_COOKIE_NAME = "sidebar_state";

/** One-week lifetime for the persisted sidebar state cookie. */
export const SIDEBAR_COOKIE_MAX_AGE =
  SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY * DAYS_PER_WEEK;

/** Runtime contract for a sidebar state cookie write. */
export const SidebarStateCookie = Schema.Struct({
  cookieName: Schema.String,
  open: Schema.Boolean,
});

/** Schema-derived input accepted by sidebar persistence. */
export type SidebarStateCookie = Schema.Schema.Type<typeof SidebarStateCookie>;

/** Expected browser failure while persisting sidebar state. */
export class SidebarStatePersistenceError extends Schema.TaggedError<SidebarStatePersistenceError>()(
  "SidebarStatePersistenceError",
  {
    cause: Schema.Unknown,
    cookieName: Schema.String,
    message: Schema.String,
  }
) {}

/** Browser cookie writer required by the sidebar persistence program. */
export class SidebarCookieWriter extends Context.Tag(
  "@repo/design-system/SidebarCookieWriter"
)<
  SidebarCookieWriter,
  {
    readonly write: (
      cookie: string,
      cookieName: string
    ) => Effect.Effect<void, SidebarStatePersistenceError>;
  }
>() {}

const writeBrowserCookie = Effect.fn("designSystem.sidebar.writeBrowserCookie")(
  function* (cookie: string, cookieName: string) {
    yield* Effect.try({
      try: () => {
        // biome-ignore lint/suspicious/noDocumentCookie: this is the browser persistence boundary owned by the sidebar
        document.cookie = cookie;
      },
      catch: (cause) =>
        new SidebarStatePersistenceError({
          cause,
          cookieName,
          message: `Failed to persist sidebar state in ${cookieName}.`,
        }),
    });
  }
);

/** Live browser implementation of sidebar cookie persistence. */
export const BrowserSidebarCookieWriterLive = Layer.succeed(
  SidebarCookieWriter,
  { write: writeBrowserCookie }
);

/** Builds and persists the sidebar state cookie through its writer service. */
export const persistSidebarState = Effect.fn(
  "designSystem.sidebar.persistState"
)(function* ({ cookieName, open }: SidebarStateCookie) {
  const writer = yield* SidebarCookieWriter;
  const cookie = `${cookieName}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;

  yield* writer.write(cookie, cookieName);
});

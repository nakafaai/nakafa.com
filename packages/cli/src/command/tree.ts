import { NAKAFA_API_BASE_URL } from "@repo/contents/agent/constants";
import { NakafaAgentQuranReferenceOptionsSchema } from "@repo/contents/agent/schema/quran/input";
import { NakafaAgentSectionSchema } from "@repo/contents/agent/schema/ref";
import { LocaleSchema } from "@repo/contents/content";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import {
  ApiBaseSchema,
  type CliRequest,
  CliRequestSchema,
  COMMAND_NAME,
  PositiveIntegerSchema,
  SearchLimitSchema,
  SearchOffsetSchema,
} from "#cli/command/spec";
import { InvocationError } from "#cli/error";

type ExecuteRequest<E, R> = (request: CliRequest) => Effect.Effect<void, E, R>;

const FLAG_NAME = {
  apiBase: "api-base",
  cursor: "cursor",
  period: "period",
  status: "status",
  fromVerse: "from-verse",
  limit: "limit",
  locale: "locale",
  offset: "offset",
  pretty: "pretty",
  section: "section",
  tafsir: "tafsir",
  toVerse: "to-verse",
} as const;

const LocaleInputSchema = Schema.String.pipe(Schema.decodeTo(LocaleSchema));
const PersonStatusInputSchema = Schema.String.pipe(
  Schema.decodeTo(Schema.Literals(["active", "suspended", "removed"]))
);
const SectionInputSchema = Schema.String.pipe(
  Schema.decodeTo(NakafaAgentSectionSchema)
);

const optionalOnce = <A>(flag: Flag.Flag<A>) =>
  flag.pipe(Flag.atMost(1), Flag.map(Option.fromIterable));

const withDefaultOnce = <A>(flag: Flag.Flag<A>, fallback: A) =>
  optionalOnce(flag).pipe(Flag.map(Option.getOrElse(() => fallback)));

const optionalLocale = () =>
  Flag.String(FLAG_NAME.locale).pipe(
    Flag.withSchema(LocaleInputSchema),
    optionalOnce,
    Flag.withDescription("Restrict results to one content locale")
  );

/** Builds the complete typed command tree for one CLI execution boundary. */
export function makeCliCommand<E, R>(execute: ExecuteRequest<E, R>) {
  const root = Command.make("nakafa").pipe(
    Command.withDescription(
      "Nakafa CLI for the public REST API and MCP server"
    ),
    Command.withSharedFlags({
      apiBase: Flag.String(FLAG_NAME.apiBase).pipe(
        Flag.withSchema(ApiBaseSchema),
        Flag.map((value) => new URL(value).origin),
        (flag) => withDefaultOnce(flag, NAKAFA_API_BASE_URL),
        Flag.withDescription("Override the public Nakafa API origin")
      ),
      pretty: Flag.Boolean(FLAG_NAME.pretty).pipe(
        Flag.withAlias("p"),
        (flag) => withDefaultOnce(flag, false),
        Flag.withDescription("Indent JSON output")
      ),
    })
  );

  const dispatch = (command: CliRequest["command"]) =>
    Effect.gen(function* () {
      const { apiBase, pretty } = yield* root;
      const request = yield* Schema.decodeEffect(CliRequestSchema, {
        onExcessProperty: "error",
      })({ apiBase, command, pretty }).pipe(
        Effect.mapError(
          (cause) =>
            new InvocationError({
              message: `Invalid command options: ${String(cause)}`,
            })
        )
      );
      yield* execute(request);
    });

  const search = Command.make(
    COMMAND_NAME.search,
    {
      limit: Flag.Int(FLAG_NAME.limit).pipe(
        Flag.withSchema(SearchLimitSchema),
        optionalOnce,
        Flag.withDescription("Maximum number of search results")
      ),
      locale: optionalLocale(),
      offset: Flag.Int(FLAG_NAME.offset).pipe(
        Flag.withSchema(SearchOffsetSchema),
        optionalOnce,
        Flag.withDescription("Search result offset")
      ),
      query: Argument.String("query").pipe(
        Argument.variadic({ min: 1 }),
        Argument.withDescription("Search query")
      ),
      section: Flag.String(FLAG_NAME.section).pipe(
        Flag.withSchema(SectionInputSchema),
        optionalOnce,
        Flag.withDescription("Restrict results to one content section")
      ),
    },
    ({ limit, locale, offset, query, section }) =>
      dispatch({
        kind: "search",
        limit: Option.getOrUndefined(limit),
        locale: Option.getOrUndefined(locale),
        offset: Option.getOrUndefined(offset),
        query: Arr.join(query, " "),
        section: Option.getOrUndefined(section),
      })
  ).pipe(Command.withDescription("Search Nakafa content"));

  const get = Command.make(
    COMMAND_NAME.get,
    {
      ref: Argument.String("content-ref").pipe(
        Argument.withDescription("Canonical URL or Nakafa content reference")
      ),
    },
    ({ ref }) => dispatch({ kind: "get", ref })
  ).pipe(Command.withDescription("Fetch one content document"));

  const taxonomy = Command.make(
    COMMAND_NAME.taxonomy,
    { locale: optionalLocale() },
    ({ locale }) =>
      dispatch({
        kind: "taxonomy",
        locale: Option.getOrUndefined(locale),
      })
  ).pipe(Command.withDescription("Read the published content taxonomy"));

  const quran = Command.make(
    COMMAND_NAME.quran,
    {
      fromVerse: Flag.Int(FLAG_NAME.fromVerse).pipe(
        Flag.withSchema(PositiveIntegerSchema),
        optionalOnce,
        Flag.withDescription("First verse to include")
      ),
      includeTafsir: Flag.Boolean(FLAG_NAME.tafsir).pipe(
        (flag) => withDefaultOnce(flag, false),
        Flag.withDescription("Include the published tafsir")
      ),
      locale: optionalLocale(),
      surah: Argument.Int("surah").pipe(
        Argument.withSchema(
          NakafaAgentQuranReferenceOptionsSchema.fields.surah
        ),
        Argument.withDescription("Surah number")
      ),
      toVerse: Flag.Int(FLAG_NAME.toVerse).pipe(
        Flag.withSchema(PositiveIntegerSchema),
        optionalOnce,
        Flag.withDescription("Last verse to include")
      ),
    },
    ({ fromVerse, includeTafsir, locale, surah, toVerse }) =>
      dispatch({
        fromVerse: Option.getOrUndefined(fromVerse),
        includeTafsir,
        kind: "quran",
        locale: Option.getOrUndefined(locale),
        surah,
        toVerse: Option.getOrUndefined(toVerse),
      })
  ).pipe(Command.withDescription("Read a Quran passage"));

  const mcp = Command.make(COMMAND_NAME.mcp, {}, () =>
    dispatch({ kind: "mcp" })
  ).pipe(Command.withDescription("Print the public MCP connection metadata"));

  const cursor = Flag.String(FLAG_NAME.cursor).pipe(
    optionalOnce,
    Flag.withDescription("The next cursor of the previous page")
  );
  const period = Flag.String(FLAG_NAME.period).pipe(
    Flag.withDescription("The ID of the period, from `nakafa school periods`")
  );

  const login = Command.make(
    "login",
    {
      host: Argument.String("school-host").pipe(
        Argument.withDescription(
          "The school's host, such as harapan.nakafa.com"
        )
      ),
    },
    ({ host }) => dispatch({ host, kind: "school-login" })
  ).pipe(
    Command.withDescription(
      "Sign in to a school: its Admin connects this device to one integration client"
    )
  );
  const logout = Command.make("logout", {}, () =>
    dispatch({ kind: "school-logout" })
  ).pipe(Command.withDescription("Remove the stored school sign-in"));
  const periods = Command.make("periods", {}, () =>
    dispatch({ kind: "school-read", read: { read: "periods" } })
  ).pipe(Command.withDescription("List the periods of the school"));
  const cohorts = Command.make("cohorts", { cursor, period }, (options) =>
    dispatch({
      kind: "school-read",
      read: {
        cursor: Option.getOrUndefined(options.cursor),
        period: options.period,
        read: "cohorts",
      },
    })
  ).pipe(Command.withDescription("List the class groups of one period"));
  const placements = Command.make("placements", { cursor, period }, (options) =>
    dispatch({
      kind: "school-read",
      read: {
        cursor: Option.getOrUndefined(options.cursor),
        period: options.period,
        read: "placements",
      },
    })
  ).pipe(Command.withDescription("List which student is in which class group"));
  const people = Command.make(
    "people",
    {
      cursor,
      status: Flag.String(FLAG_NAME.status).pipe(
        Flag.withSchema(PersonStatusInputSchema),
        optionalOnce,
        Flag.withDescription("active, suspended, or removed")
      ),
    },
    (options) =>
      dispatch({
        kind: "school-read",
        read: {
          cursor: Option.getOrUndefined(options.cursor),
          read: "people",
          status: Option.getOrUndefined(options.status),
        },
      })
  ).pipe(Command.withDescription("List the people of the school"));
  const school = Command.make(COMMAND_NAME.school).pipe(
    Command.withDescription("Read a school's roster as its integration client"),
    Command.withSubcommands([
      login,
      logout,
      periods,
      cohorts,
      people,
      placements,
    ])
  );

  return root.pipe(
    Command.withSubcommands([search, get, taxonomy, quran, mcp, school])
  );
}

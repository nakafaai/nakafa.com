import { NAKAFA_API_BASE_URL } from "@repo/contents/_lib/agent/constants";
import { NakafaAgentQuranReferenceOptionsSchema } from "@repo/contents/_lib/agent/schema/quran/input";
import { NakafaAgentSectionSchema } from "@repo/contents/_lib/agent/schema/ref";
import { LocaleSchema } from "@repo/contents/_types/content";
import { Effect, Option, Schema } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";
import {
  ApiBaseSchema,
  type CliRequest,
  CliRequestSchema,
  PositiveIntegerSchema,
  SearchLimitSchema,
  SearchOffsetSchema,
} from "#cli/command/spec";
import { InvocationError } from "#cli/error";

type ExecuteRequest<E, R> = (request: CliRequest) => Effect.Effect<void, E, R>;

const LocaleInputSchema = Schema.String.pipe(Schema.decodeTo(LocaleSchema));
const SectionInputSchema = Schema.String.pipe(
  Schema.decodeTo(NakafaAgentSectionSchema)
);

const optionalLocale = () =>
  Flag.string("locale").pipe(
    Flag.withSchema(LocaleInputSchema),
    Flag.optional,
    Flag.withDescription("Restrict results to one content locale")
  );

/** Builds the complete typed command tree for one CLI execution boundary. */
export function makeCliCommand<E, R>(execute: ExecuteRequest<E, R>) {
  const root = Command.make("nakafa").pipe(
    Command.withDescription(
      "Nakafa CLI for the public REST API and MCP server"
    ),
    Command.withSharedFlags({
      apiBase: Flag.string("api-base").pipe(
        Flag.withSchema(ApiBaseSchema),
        Flag.map((value) => new URL(value).origin),
        Flag.withDefault(NAKAFA_API_BASE_URL),
        Flag.withDescription("Override the public Nakafa API origin")
      ),
      pretty: Flag.boolean("pretty").pipe(
        Flag.withAlias("p"),
        Flag.withDefault(false),
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
    "search",
    {
      limit: Flag.integer("limit").pipe(
        Flag.withSchema(SearchLimitSchema),
        Flag.optional,
        Flag.withDescription("Maximum number of search results")
      ),
      locale: optionalLocale(),
      offset: Flag.integer("offset").pipe(
        Flag.withSchema(SearchOffsetSchema),
        Flag.optional,
        Flag.withDescription("Search result offset")
      ),
      query: Argument.string("query").pipe(
        Argument.variadic({ min: 1 }),
        Argument.withDescription("Search query")
      ),
      section: Flag.string("section").pipe(
        Flag.withSchema(SectionInputSchema),
        Flag.optional,
        Flag.withDescription("Restrict results to one content section")
      ),
    },
    ({ limit, locale, offset, query, section }) =>
      dispatch({
        kind: "search",
        limit: Option.getOrUndefined(limit),
        locale: Option.getOrUndefined(locale),
        offset: Option.getOrUndefined(offset),
        query: query.join(" "),
        section: Option.getOrUndefined(section),
      })
  ).pipe(Command.withDescription("Search Nakafa content"));

  const get = Command.make(
    "get",
    {
      ref: Argument.string("content-ref").pipe(
        Argument.withDescription("Canonical URL or Nakafa content reference")
      ),
    },
    ({ ref }) => dispatch({ kind: "get", ref })
  ).pipe(Command.withDescription("Fetch one content document"));

  const taxonomy = Command.make(
    "taxonomy",
    { locale: optionalLocale() },
    ({ locale }) =>
      dispatch({
        kind: "taxonomy",
        locale: Option.getOrUndefined(locale),
      })
  ).pipe(Command.withDescription("Read the published content taxonomy"));

  const quran = Command.make(
    "quran",
    {
      fromVerse: Flag.integer("from-verse").pipe(
        Flag.withSchema(PositiveIntegerSchema),
        Flag.optional,
        Flag.withDescription("First verse to include")
      ),
      includeTafsir: Flag.boolean("tafsir").pipe(
        Flag.withDefault(false),
        Flag.withDescription("Include the published tafsir")
      ),
      locale: optionalLocale(),
      surah: Argument.integer("surah").pipe(
        Argument.withSchema(
          NakafaAgentQuranReferenceOptionsSchema.fields.surah
        ),
        Argument.withDescription("Surah number")
      ),
      toVerse: Flag.integer("to-verse").pipe(
        Flag.withSchema(PositiveIntegerSchema),
        Flag.optional,
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

  const mcp = Command.make("mcp", {}, () => dispatch({ kind: "mcp" })).pipe(
    Command.withDescription("Print the public MCP connection metadata")
  );

  return root.pipe(
    Command.withSubcommands([search, get, taxonomy, quran, mcp])
  );
}

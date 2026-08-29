import { NakafaAgentQuranReferenceOptionsSchema } from "@repo/contents/_lib/agent/schema/quran/input";
import { NakafaAgentSectionSchema } from "@repo/contents/_lib/agent/schema/ref";
import {
  NAKAFA_AGENT_MAX_LIMIT,
  NAKAFA_AGENT_MAX_OFFSET,
} from "@repo/contents/_types/agent/search";
import { LocaleSchema } from "@repo/contents/_types/content";
import { Schema } from "effect";

export const COMMAND_NAME = {
  get: "get",
  mcp: "mcp",
  quran: "quran",
  search: "search",
  taxonomy: "taxonomy",
} as const;

export const PositiveIntegerSchema = Schema.Finite.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThan(0))
);
export const SearchLimitSchema = PositiveIntegerSchema.pipe(
  Schema.check(Schema.isLessThanOrEqualTo(NAKAFA_AGENT_MAX_LIMIT))
);
export const SearchOffsetSchema = Schema.Finite.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(
    Schema.isBetween({ minimum: 0, maximum: NAKAFA_AGENT_MAX_OFFSET })
  )
);
export const ApiBaseSchema = Schema.String.check(
  Schema.makeFilter(isHttpOrigin, {
    message: "Expected --api-base to be an HTTP or HTTPS origin.",
  })
);

const SearchCommandSchema = Schema.Struct({
  kind: Schema.Literal(COMMAND_NAME.search),
  limit: Schema.optional(SearchLimitSchema),
  locale: Schema.optional(LocaleSchema),
  offset: Schema.optional(SearchOffsetSchema),
  query: Schema.Trim.pipe(Schema.check(Schema.isNonEmpty())),
  section: Schema.optional(NakafaAgentSectionSchema),
});
const GetCommandSchema = Schema.Struct({
  kind: Schema.Literal(COMMAND_NAME.get),
  ref: Schema.Trim.pipe(Schema.check(Schema.isNonEmpty())),
});
const TaxonomyCommandSchema = Schema.Struct({
  kind: Schema.Literal(COMMAND_NAME.taxonomy),
  locale: Schema.optional(LocaleSchema),
});
const QuranCommandSchema = Schema.Struct({
  fromVerse: Schema.optional(PositiveIntegerSchema),
  includeTafsir: Schema.Boolean,
  kind: Schema.Literal(COMMAND_NAME.quran),
  locale: Schema.optional(LocaleSchema),
  surah: NakafaAgentQuranReferenceOptionsSchema.fields.surah,
  toVerse: Schema.optional(PositiveIntegerSchema),
});
const CliCommandSchema = Schema.Union([
  SearchCommandSchema,
  GetCommandSchema,
  TaxonomyCommandSchema,
  QuranCommandSchema,
  Schema.Struct({ kind: Schema.Literal(COMMAND_NAME.mcp) }),
]);

export const CliRequestSchema = Schema.Struct({
  apiBase: ApiBaseSchema,
  command: CliCommandSchema,
  pretty: Schema.Boolean,
});

export type CliRequest = Schema.Schema.Type<typeof CliRequestSchema>;
export type CliCommand = Schema.Schema.Type<typeof CliCommandSchema>;

/** Checks that an API override is exactly one HTTP or HTTPS origin. */
function isHttpOrigin(value: string) {
  if (!URL.canParse(value)) {
    return false;
  }
  const url = new URL(value);
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    url.username === "" &&
    url.password === "" &&
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === ""
  );
}

import { LocaleSchema } from "@repo/contents/_types/content";
import { PublicRoutePathSchema } from "@repo/contents/_types/route/segment";
import { Schema } from "effect";

export class DuplicatePublicRouteError extends Schema.TaggedError<DuplicatePublicRouteError>()(
  "DuplicatePublicRouteError",
  {
    duplicateKind: Schema.String,
    existingKind: Schema.String,
    locale: LocaleSchema,
    publicPath: PublicRoutePathSchema,
  }
) {}

export class InvalidPublicRouteSourceError extends Schema.TaggedError<InvalidPublicRouteSourceError>()(
  "InvalidPublicRouteSourceError",
  {
    message: Schema.String,
  }
) {}

export class MissingPublicSlugError extends Schema.TaggedError<MissingPublicSlugError>()(
  "MissingPublicSlugError",
  {
    locale: LocaleSchema,
    source: Schema.String,
    value: Schema.String,
  }
) {}

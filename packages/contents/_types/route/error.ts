import { LocaleSchema } from "@repo/contents/_types/content";
import { PublicRoutePathSchema } from "@repo/contents/_types/route/segment";
import { Schema } from "effect";

/** Raised when two projected route rows try to publish the same localized public path. */
export class DuplicatePublicRouteError extends Schema.TaggedError<DuplicatePublicRouteError>()(
  "DuplicatePublicRouteError",
  {
    duplicateKind: Schema.String,
    existingKind: Schema.String,
    locale: LocaleSchema,
    publicPath: PublicRoutePathSchema,
  }
) {}

/** Raised when a source route cannot be mapped to an owned public route surface. */
export class InvalidPublicRouteSourceError extends Schema.TaggedError<InvalidPublicRouteSourceError>()(
  "InvalidPublicRouteSourceError",
  {
    message: Schema.String,
  }
) {}

/** Raised when one locale is missing the public slug required for route projection. */
export class MissingPublicSlugError extends Schema.TaggedError<MissingPublicSlugError>()(
  "MissingPublicSlugError",
  {
    locale: LocaleSchema,
    source: Schema.String,
    value: Schema.String,
  }
) {}

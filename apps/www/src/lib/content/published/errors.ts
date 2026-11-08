import {
  ContentKeySchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { Schema } from "effect";
/** A verified content tree could not be rendered into React elements. */
export class ContentExecutionError extends Schema.TaggedError<
  ContentExecutionError,
  { readonly brand: unique symbol }
>()("ContentExecutionError", {
  contentKey: ContentKeySchema,
  stage: Schema.Literal("render"),
}) {}
/** A verified projection cannot satisfy its requested public surface. */
export class PublishedProjectionError extends Schema.TaggedError<
  PublishedProjectionError,
  { readonly brand: unique symbol }
>()("PublishedProjectionError", {
  appLocale: AppLocaleSchema,
  publicPath: Schema.String,
}) {}
/** One public route has no active signed body. */
export class PublishedMissingError extends Schema.TaggedError<
  PublishedMissingError,
  { readonly brand: unique symbol }
>()("PublishedMissingError", {
  appLocale: AppLocaleSchema,
  publicPath: Schema.String,
}) {}
/** Public route identity attached to a malformed signed projection. */
export type PublishedProjectionIdentity = Pick<
  PublishedProjectionError,
  "appLocale" | "publicPath"
>;
/** Two release-bound reads observed different active publication identities. */
export class PublishedReleaseMismatchError extends Schema.TaggedError<
  PublishedReleaseMismatchError,
  { readonly brand: unique symbol }
>()("PublishedReleaseMismatchError", {
  actualReleaseId: Schema.NullOr(ReleaseIdSchema),
  expectedReleaseId: Schema.NullOr(ReleaseIdSchema),
}) {}

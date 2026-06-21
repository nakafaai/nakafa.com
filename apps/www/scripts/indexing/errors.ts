import { Schema } from "effect";

/** Expected failure while creating, reading, or writing ignored indexing state. */
export class SubmissionHistoryError extends Schema.TaggedError<SubmissionHistoryError>()(
  "SubmissionHistoryError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Expected failure while submitting one IndexNow batch. */
export class IndexNowSubmitError extends Schema.TaggedError<IndexNowSubmitError>()(
  "IndexNowSubmitError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Expected transport failure while submitting one Bing URL batch. */
export class BingSubmitError extends Schema.TaggedError<BingSubmitError>()(
  "BingSubmitError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Expected failure while signing the Google service-account JWT assertion. */
export class GoogleAssertionSignError extends Schema.TaggedError<GoogleAssertionSignError>()(
  "GoogleAssertionSignError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Expected failure returned by Google's OAuth token endpoint. */
export class GoogleTokenRequestError extends Schema.TaggedError<GoogleTokenRequestError>()(
  "GoogleTokenRequestError",
  {
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
    responseText: Schema.optional(Schema.String),
  }
) {}

/** Expected failure while submitting one URL to Google Indexing. */
export class GoogleIndexSubmitError extends Schema.TaggedError<GoogleIndexSubmitError>()(
  "GoogleIndexSubmitError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Expected failure while fetching a sitemap URL for structured-data proof. */
export class GoogleIndexPageFetchError extends Schema.TaggedError<GoogleIndexPageFetchError>()(
  "GoogleIndexPageFetchError",
  {
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
    url: Schema.String,
  }
) {}

/** Expected failure while parsing JSON-LD from a sitemap URL. */
export class GoogleStructuredDataParseError extends Schema.TaggedError<GoogleStructuredDataParseError>()(
  "GoogleStructuredDataParseError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
    url: Schema.String,
  }
) {}

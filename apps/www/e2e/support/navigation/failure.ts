import { Schema } from "effect";
import { RequestFailureKindSchema } from "../request-tracker";

export const NavigationReadinessPhaseSchema = Schema.Literals([
  "hydration",
  "prefetch",
  "source",
  "viewport",
]);

/** One bounded navigation-readiness phase did not complete. */
export class NavigationReadinessTimeout extends Schema.TaggedError<NavigationReadinessTimeout>()(
  "NavigationReadinessTimeout",
  {
    errorText: Schema.optional(Schema.String),
    href: Schema.String,
    phase: NavigationReadinessPhaseSchema,
    sourceHref: Schema.String,
    timeoutMilliseconds: Schema.Finite,
  }
) {}

/** Playwright could not inspect one browser-owned readiness signal. */
export class NavigationBrowserReadinessError extends Schema.TaggedError<NavigationBrowserReadinessError>()(
  "NavigationBrowserReadinessError",
  {
    errorText: Schema.optional(Schema.String),
    href: Schema.String,
    phase: NavigationReadinessPhaseSchema,
    sourceHref: Schema.String,
  }
) {}

/** A source document or exact target prefetch request did not succeed. */
export class NavigationRequestError extends Schema.TaggedError<NavigationRequestError>()(
  "NavigationRequestError",
  {
    errorText: Schema.optional(Schema.String),
    href: Schema.String,
    kind: RequestFailureKindSchema,
    sourceHref: Schema.String,
    status: Schema.optional(Schema.Finite),
    url: Schema.String,
  }
) {}

export const readErrorText = (error: unknown) =>
  error instanceof Error ? error.message : undefined;

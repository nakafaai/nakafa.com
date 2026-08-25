import { Schema } from "effect";
import {
  formatRequestFailure,
  requestFailureFields,
  TrackedRequestSchema,
} from "../request-tracker";

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
    pendingPrefetches: Schema.optional(Schema.Array(TrackedRequestSchema)),
    phase: NavigationReadinessPhaseSchema,
    prefetchObserved: Schema.optional(Schema.Boolean),
    sourceHref: Schema.String,
    successfulPrefetches: Schema.optional(Schema.Finite),
    timeoutMilliseconds: Schema.Finite,
  }
) {
  get message() {
    const errorText =
      this.errorText === undefined ? "" : ` errorText=${this.errorText}`;
    const prefetchObserved =
      this.prefetchObserved === undefined
        ? ""
        : ` prefetchObserved=${this.prefetchObserved}`;
    const successfulPrefetches =
      this.successfulPrefetches === undefined
        ? ""
        : ` successfulPrefetches=${this.successfulPrefetches}`;
    const pendingPrefetches =
      this.pendingPrefetches === undefined
        ? ""
        : ` pendingPrefetches=${JSON.stringify(this.pendingPrefetches)}`;
    return `Navigation readiness timed out: phase=${this.phase} sourceHref=${this.sourceHref} href=${this.href} timeoutMilliseconds=${this.timeoutMilliseconds}${prefetchObserved}${successfulPrefetches}${pendingPrefetches}${errorText}`;
  }
}

/** Playwright could not inspect one browser-owned readiness signal. */
export class NavigationBrowserReadinessError extends Schema.TaggedError<NavigationBrowserReadinessError>()(
  "NavigationBrowserReadinessError",
  {
    errorText: Schema.optional(Schema.String),
    href: Schema.String,
    phase: NavigationReadinessPhaseSchema,
    sourceHref: Schema.String,
  }
) {
  get message() {
    const errorText =
      this.errorText === undefined ? "" : ` errorText=${this.errorText}`;
    return `Browser readiness failed: phase=${this.phase} sourceHref=${this.sourceHref} href=${this.href}${errorText}`;
  }
}

/** A source document or exact target prefetch request did not succeed. */
export class NavigationRequestError extends Schema.TaggedError<NavigationRequestError>()(
  "NavigationRequestError",
  {
    href: Schema.String,
    ...requestFailureFields,
    sourceHref: Schema.String,
  }
) {
  get message() {
    return `Navigation request failed: sourceHref=${this.sourceHref} href=${this.href} ${formatRequestFailure(this)}`;
  }
}

export const readErrorText = (error: unknown) =>
  error instanceof Error ? error.message : undefined;

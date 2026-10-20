import {
  createOperationalException,
  decodeOperationalExceptionProperties,
  type OperationalExceptionProperties,
} from "@repo/analytics/posthog/exception";
import { Array as Arr, MutableRef, Option } from "effect";
import type { PostHog } from "posthog-js";

/**
 * The PostHog client methods that the browser runtime calls. This leaf owns the
 * loaded client, so error boundaries can report without the consent and identity
 * graph that the runtime loads.
 */
export type BrowserAnalyticsClient = Pick<
  PostHog,
  | "capture"
  | "captureException"
  | "get_explicit_consent_status"
  | "get_property"
  | "identify"
  | "init"
  | "opt_in_capturing"
  | "opt_out_capturing"
  | "register"
  | "reset"
  | "setPersonProperties"
>;

/** Sends one handled exception through a client that has loaded. */
type ExceptionCapture = (client: BrowserAnalyticsClient) => void;

const analyticsClient = MutableRef.make<BrowserAnalyticsClient | undefined>(
  undefined
);

/**
 * Handled exceptions raised before the baseline client loads, in the order they
 * happened. The idle wait can run for seconds, so these wait here and reach
 * PostHog once the client exists. The queue keeps its first entries and stops
 * there, so a load that never completes cannot grow it without limit.
 */
const PENDING_EXCEPTION_LIMIT = 20;
const pendingExceptionCaptures = MutableRef.make<readonly ExceptionCapture[]>(
  []
);

/** Returns the baseline client once it has loaded, and undefined before that. */
export function readAnalyticsClient() {
  return MutableRef.get(analyticsClient);
}

/**
 * Publishes the loaded baseline client, then sends the exceptions that waited
 * for it, and empties the queue.
 */
export function publishAnalyticsClient(client: BrowserAnalyticsClient) {
  MutableRef.set(analyticsClient, client);
  Arr.forEach(MutableRef.get(pendingExceptionCaptures), (capture) =>
    capture(client)
  );
  MutableRef.set(pendingExceptionCaptures, []);
}

/**
 * Captures one handled client exception through the always-on baseline.
 *
 * The minimized operational payload carries no identity or user content, so
 * scrubbed reliability reporting stays available in every consent state. The
 * baseline before_send gate additionally minimizes event URLs. Before the
 * baseline client loads, the capture waits in a bounded queue and is sent once
 * the client loads.
 */
export function captureException(
  error: unknown,
  properties: OperationalExceptionProperties
) {
  const decodedProperties = decodeOperationalExceptionProperties(properties);
  if (Option.isNone(decodedProperties)) {
    return;
  }
  const capture: ExceptionCapture = (client) =>
    client.captureException(
      createOperationalException(error, decodedProperties.value),
      decodedProperties.value
    );
  const client = MutableRef.get(analyticsClient);
  if (client) {
    capture(client);
    return;
  }
  const pending = MutableRef.get(pendingExceptionCaptures);
  if (pending.length < PENDING_EXCEPTION_LIMIT) {
    MutableRef.set(pendingExceptionCaptures, Arr.append(pending, capture));
  }
}

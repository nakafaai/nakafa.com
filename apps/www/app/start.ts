import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start";
import { Effect, Option } from "effect";
import { FetchHttpClient } from "effect/http";
import { clientEnv } from "@/env.client";
import { hintCookieFor, hintScopeFor, isHintCurrent } from "@/lib/auth/hint";
import { pinServerFunctionUrl } from "@/lib/deployment/pin";
import { pricingCurrencyCookieFor } from "@/lib/pricing/currency";

/**
 * Creates the request's session memo and reads the session once for the whole
 * request, so every reader shares that read. The signed-in hint follows the
 * session: it is set when the request's hint is out of date, so a response
 * sets no cookie when nothing changed. A failed read sets no hint, and the page
 * readers report the failure. The server modules load only when the server runs
 * this middleware.
 */
const requestSession = createMiddleware({ type: "request" }).server(
  async ({ next, request }) => {
    const { readSessionMemo } = await import("@/lib/auth/session.server");
    const { runServerEffect } = await import("@/lib/server/fn");
    const session = await runServerEffect(
      Effect.flatten(readSessionMemo(request)).pipe(Effect.option)
    );
    if (
      Option.isSome(session) &&
      !isHintCurrent(session.value.client, request.headers)
    ) {
      const { appendResponseHeader } = await import(
        "@tanstack/react-start/server"
      );
      const { env } = await import("@/env");
      appendResponseHeader(
        "set-cookie",
        hintCookieFor(session.value.client, hintScopeFor(new URL(env.SITE_URL)))
      );
    }
    return next();
  }
);

/**
 * Keeps the visitor's price currency in its cookie, set from the country of the
 * request while the cookie is unset, so the first paint shows the visitor's price.
 */
const pricingCurrency = createMiddleware({ type: "request" }).server(
  async ({ next, request }) => {
    const cookie = pricingCurrencyCookieFor(request.headers);
    if (Option.isSome(cookie)) {
      const { appendResponseHeader } = await import(
        "@tanstack/react-start/server"
      );
      appendResponseHeader("set-cookie", cookie.value);
    }
    return next();
  }
);

/**
 * Sends a browser server-function call to the deployment that built this page
 * (decision 14). The transport is the Fetch service of Effect's HTTP client, which
 * the framework seam receives as a plain function. A server-side call never
 * reaches this seam.
 */
const pinnedServerFnFetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const target =
    typeof input === "string"
      ? pinServerFunctionUrl(
          input,
          clientEnv.VITE_VERCEL_DEPLOYMENT_ID,
          window.location.href
        )
      : input;
  return Effect.runPromise(
    Effect.flatMap(FetchHttpClient.Fetch, (fetch) =>
      Effect.promise(() => fetch(target, init))
    )
  );
};

export const startInstance = createStart(() => ({
  defaultSsr: true,
  serverFns: { fetch: pinnedServerFnFetch },
  requestMiddleware: [
    requestSession,
    pricingCurrency,
    createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" }),
  ],
}));

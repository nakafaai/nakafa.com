import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start";
import { Option } from "effect";
import { pricingCurrencyCookieFor } from "@/lib/pricing/currency";

/**
 * Creates the request's session memo before any reader runs. The memo reads
 * nothing until a reader awaits it, so a page that no reader needs makes no
 * session call, and every reader of the request shares one read. The server
 * modules load only when the server runs this middleware.
 */
const requestSession = createMiddleware({ type: "request" }).server(
  async ({ next, request }) => {
    const { readSessionMemo } = await import("@/lib/auth/session.server");
    const { runServerEffect } = await import("@/lib/server/fn");
    await runServerEffect(readSessionMemo(request));
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

export const startInstance = createStart(() => ({
  defaultSsr: true,
  requestMiddleware: [
    requestSession,
    pricingCurrency,
    createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" }),
  ],
}));

import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start";

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
    const session = await runServerEffect(readSessionMemo(request));
    return next({ context: { session } });
  }
);

export const startInstance = createStart(() => ({
  defaultSsr: true,
  requestMiddleware: [
    requestSession,
    createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" }),
  ],
}));

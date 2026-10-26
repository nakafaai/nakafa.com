import { createIsomorphicFn } from "@tanstack/react-start";
import { hasSignedInHint } from "@/lib/auth/hint";
import { sessionFn } from "@/lib/auth/session.functions";

/**
 * Whether the visitor is signed in, as a route gate reads it: the session on the
 * server, and the signed-in hint in the browser. A gate runs on every move between
 * pages, so the browser reads the hint and waits on no server request. Every
 * account read checks the session itself, so a stale hint opens no data.
 */
export const isSignedIn = createIsomorphicFn()
  .server(async () => (await sessionFn())._tag === "SignedIn")
  .client(() => Promise.resolve(hasSignedInHint(document.cookie)));

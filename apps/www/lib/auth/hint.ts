import { Array as Arr } from "effect";
import type { ClientSession } from "@/lib/auth/visitor";

/**
 * The cookie that tells a public page, before any script runs, whether a session
 * may exist. It is not HttpOnly, so the first paint can read it. It is a hint for
 * the layout only: a forged value shows a placeholder, and the session read says
 * the truth.
 */
const SIGNED_IN_HINT_COOKIE = "nakafa-signed-in";

/** The attribute of the root element that the inline script sets from the hint. */
export const SIGNED_IN_ATTRIBUTE = "data-signed-in";

/** The lifetime of the hint, which matches the session lifetime of seven days. */
const HINT_MAX_AGE = 60 * 60 * 24 * 7;

/** The attributes that every hint cookie shares. */
function hintAttributes(secure: boolean) {
  return `Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** The cookie that a response sets when the visitor has a session. */
export function signedInHintCookie(secure: boolean) {
  return `${SIGNED_IN_HINT_COOKIE}=1; ${hintAttributes(secure)}; Max-Age=${HINT_MAX_AGE}`;
}

/** The cookie that a response clears when the session ends. */
export function expiredHintCookie(secure: boolean) {
  return `${SIGNED_IN_HINT_COOKIE}=; ${hintAttributes(secure)}; Max-Age=0`;
}

/** The hint cookie that matches a session: set when the visitor is signed in, cleared otherwise. */
export function hintCookieFor(session: ClientSession, secure: boolean) {
  return session._tag === "SignedIn"
    ? signedInHintCookie(secure)
    : expiredHintCookie(secure);
}

/** The inline script that sets the sign-in attribute of the root element before the first paint. */
export function signedInHintScript(): string {
  return Arr.join(
    [
      "(function () {",
      `  var signedIn = document.cookie.split(';').some(function (pair) {`,
      `    return pair.trim() === '${SIGNED_IN_HINT_COOKIE}=1';`,
      "  });",
      `  document.documentElement.setAttribute('${SIGNED_IN_ATTRIBUTE}', signedIn ? 'yes' : 'no');`,
      "})();",
    ],
    "\n"
  );
}

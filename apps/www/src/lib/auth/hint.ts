import { Array as Arr, Option, Schema } from "effect";
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

/**
 * Where the hint cookie lives: the domain of the session cookie, so every school
 * host under it reads the hint, and whether the site is served over https.
 */
const HintScope = Schema.Struct({
  domain: Schema.String,
  secure: Schema.Boolean,
});

type HintScope = typeof HintScope.Type;

/** The attributes that every hint cookie shares. */
function hintAttributes(scope: HintScope) {
  return `Domain=${scope.domain}; Path=/; SameSite=Lax${scope.secure ? "; Secure" : ""}`;
}

/** The cookie that a response sets when the visitor has a session. */
export function signedInHintCookie(scope: HintScope) {
  return `${SIGNED_IN_HINT_COOKIE}=1; ${hintAttributes(scope)}; Max-Age=${HINT_MAX_AGE}`;
}

/** The cookie that a response clears when the session ends. */
export function expiredHintCookie(scope: HintScope) {
  return `${SIGNED_IN_HINT_COOKIE}=; ${hintAttributes(scope)}; Max-Age=0`;
}

/** The hint cookie that matches a session: set when the visitor is signed in, cleared otherwise. */
export function hintCookieFor(session: ClientSession, scope: HintScope) {
  return session._tag === "SignedIn"
    ? signedInHintCookie(scope)
    : expiredHintCookie(scope);
}

/** The scope of the hint cookie that the site's own URL names: its host, and https when the site has it. */
export function hintScopeFor(site: URL): HintScope {
  return HintScope.make({
    domain: site.hostname,
    secure: site.protocol === "https:",
  });
}

/** The exact pair that says the visitor is signed in, as the inline script reads it. */
const SIGNED_IN_HINT_PAIR = `${SIGNED_IN_HINT_COOKIE}=1`;

/**
 * Whether the request's hint cookie already says what its session says, so the
 * response sets no hint cookie. A visitor with no hint and no session is current,
 * and so is a learner whose hint is set; any other pair is out of date.
 */
export function isHintCurrent(
  session: ClientSession,
  headers: Headers
): boolean {
  const signedIn = Option.fromNullishOr(headers.get("cookie")).pipe(
    Option.map(hasSignedInHint),
    Option.getOrElse(() => false)
  );
  return signedIn === (session._tag === "SignedIn");
}

/**
 * Whether a cookie header carries the signed-in hint, as the browser's document
 * cookie or a request's cookie header spells it.
 */
export function hasSignedInHint(cookie: string): boolean {
  return Arr.some(
    cookie.split(";"),
    (pair) => pair.trim() === SIGNED_IN_HINT_PAIR
  );
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

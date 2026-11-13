import { AUTH_REFRESH_COOKIE } from "@convex-dev/auth/ssr";
import { Array as Arr, Option, String as Str } from "effect";
import {
  expiredHintCookie,
  hintScopeFor,
  signedInHintCookie,
} from "@/lib/auth/hint";

/** The name and value of one Set-Cookie header. */
const nameAndValue = (setCookie: string) => {
  const pair = Str.split(setCookie, ";")[0] ?? "";
  const at = pair.indexOf("=");
  return at < 0
    ? Option.none()
    : Option.some({
        name: Str.trim(pair.slice(0, at)),
        value: Str.trim(pair.slice(at + 1)),
      });
};

/**
 * Whether an auth route's answer started a session (true), ended one (false),
 * or left the session as it was (none), read from the refresh cookie it wrote:
 * a value starts or keeps one, an empty value clears it.
 */
const readSessionWrite = (response: Response, prefix: string) =>
  Arr.findLast(
    Arr.filterMap(response.headers.getSetCookie(), nameAndValue),
    ({ name }) => name === `${prefix}${AUTH_REFRESH_COOKIE}`
  ).pipe(Option.map(({ value }) => value !== ""));

/**
 * The answer of an auth route with the signed-in hint that matches the session
 * it wrote, so a static page knows at once whether to start the live session.
 * An answer that wrote no session cookie keeps the hint as it is.
 */
export function withSessionHint(
  response: Response,
  site: URL,
  prefix: string
) {
  const write = readSessionWrite(response, prefix);
  if (Option.isNone(write)) {
    return response;
  }
  const scope = hintScopeFor(site);
  const headers = new Headers(response.headers);
  headers.append(
    "set-cookie",
    write.value ? signedInHintCookie(scope) : expiredHintCookie(scope)
  );
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

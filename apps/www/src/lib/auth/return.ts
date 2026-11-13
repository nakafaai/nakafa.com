import type { Locale } from "@repo/internationalization/src/locale";
import { Array as Arr, Effect, Option, Schema } from "effect";
import {
  getPostAuthSignInHref,
  resolvePostAuthIntent,
} from "@/lib/auth/admission";
import { readHostRole, SCHOOL_DOMAINS } from "@/lib/routing/school/host";
import { QueryText } from "@/lib/routing/search";

/**
 * One optional text key of the sign-in query. The router parses each value of the
 * address, so a number or a boolean reads back as its text, and a repeated key,
 * which the router parses as a list, reads as absent.
 */
const AuthReturnText = Schema.optionalKey(
  QueryText.pipe(Schema.catchDecoding(() => Effect.succeedNone))
);

/**
 * The sign-in query of an address: the destination that the sign-in resumes,
 * and the school address that a school host's visitor returns to. The button
 * renders under several routes, and a route that does not declare these keys
 * would drop them from its search, so the decoder reads the parsed search of
 * the address, which keeps every key.
 */
const AuthReturnQuery = Schema.Struct({
  redirect: AuthReturnText,
  school: AuthReturnText,
});

/** Reads the sign-in query from the parsed search of an address. A repeated key reads as absent. */
export function readAuthReturnQuery(search: unknown) {
  return Schema.decodeUnknownSync(AuthReturnQuery)(search);
}

/** The parts of a browser address that tell its site apart. */
type SiteAddress = Pick<URL, "hostname" | "port" | "protocol">;

/**
 * The school address that a visitor returns to once signed in, read from the
 * sign-in query: an address on a school host under the domain of the main site
 * the visitor signs in on, with the same scheme and port, such as
 * `https://harapan.nakafa.com/kelas` beside `https://nakafa.com`. Any other
 * address reads as none, so the query never sends a visitor off Nakafa.
 */
export function readSchoolReturn(
  text: string | undefined,
  main: SiteAddress
): Option.Option<string> {
  if (text === undefined || !URL.canParse(text)) {
    return Option.none();
  }
  const school = new URL(text);
  const sameSite =
    school.protocol === main.protocol &&
    school.port === main.port &&
    school.hostname.endsWith(`.${main.hostname}`);
  return sameSite && readHostRole(school.hostname)._tag === "School"
    ? Option.some(school.href)
    : Option.none();
}

/**
 * The main site's sign-in page for a visitor on a school host, which signs them
 * in and sends them back to `school`: the main site is the school domain the
 * host sits under, with the same scheme and port, such as `nakafa.com` for
 * `harapan.nakafa.com` and `localhost:3000` for `harapan.localhost:3000`. A
 * school host never starts Google itself: Google's flow completes on the
 * origin that started it, and the session cookie reaches every school host.
 */
export function mainSignInAddress(
  school: URL,
  locale: Locale
): Option.Option<string> {
  return Option.map(
    Arr.findFirst(SCHOOL_DOMAINS, (domain) =>
      school.hostname.endsWith(`.${domain}`)
    ),
    (domain) => {
      const main = new URL(`/${locale}/auth`, school);
      main.hostname = domain;
      main.searchParams.set("school", school.href);
      return main.href;
    }
  );
}

/**
 * The sign-in page that Google returns to, on the origin that starts the
 * sign-in, so the page's client completes it there. It resumes the intent and,
 * for a school host's visitor, the school address.
 */
export function googleReturnAddress(input: {
  readonly intent: unknown;
  readonly locale: Locale;
  readonly origin: string;
  readonly school: Option.Option<string>;
}) {
  const address = new URL(
    `/${input.locale}${getPostAuthSignInHref(resolvePostAuthIntent(input.intent, input.locale))}`,
    input.origin
  );
  if (Option.isSome(input.school)) {
    address.searchParams.set("school", input.school.value);
  }
  return address.href;
}

import {
  NewTenantSlug,
  type TenantSlug,
} from "@repo/backend/confect/tenancy/slug";
import { SCHOOL_CELL_DOMAINS } from "@repo/next-config/domains";
import { Array as Arr, Option, Record as Rec, Schema } from "effect";

/**
 * The domain of a local development server. Browsers resolve every
 * `*.localhost` name to loopback, so a school opens at `harapan.localhost`
 * without a hosts file.
 */
const LOCAL_DOMAIN = "localhost";

/** The cell domains of production, then the local domain for development. */
const SCHOOL_DOMAINS = [...Rec.values(SCHOOL_CELL_DOMAINS), LOCAL_DOMAIN];

/** Whether a label is a valid school address that Nakafa does not reserve. */
const isSchoolSlug = Schema.is(NewTenantSlug);

/** The single label in front of a domain, or none when the host is not one label under it. */
function readLabel(hostname: string, domain: string): Option.Option<string> {
  const suffix = `.${domain}`;
  if (!hostname.endsWith(suffix)) {
    return Option.none();
  }
  const label = hostname.slice(0, -suffix.length);
  return label.includes(".") ? Option.none() : Option.some(label);
}

/** The school address in front of one school domain, or none when the label is not a school address. */
function readSchoolLabel(
  hostname: string,
  domain: string
): Option.Option<TenantSlug> {
  return readLabel(hostname, domain).pipe(Option.filter(isSchoolSlug));
}

/**
 * The school address that a host names, such as `harapan` for
 * `harapan.nakafa.com`. A host outside the school domains names no school, and
 * neither does a label that the slug rules refuse, such as a reserved one.
 */
export function readSchoolSlug(hostname: string): Option.Option<TenantSlug> {
  return Arr.findFirst(SCHOOL_DOMAINS, (domain) =>
    readSchoolLabel(hostname, domain)
  );
}

/**
 * Whether a host sits under a production cell domain without naming a school.
 * The proxy redirects it to the main site, so `www` and every reserved label
 * reach the same place as before school hosts existed.
 */
export function isRefusedSchoolHost(hostname: string) {
  return (
    Arr.some(Rec.values(SCHOOL_CELL_DOMAINS), (domain) =>
      hostname.endsWith(`.${domain}`)
    ) && Option.isNone(readSchoolSlug(hostname))
  );
}

/**
 * The hostname that the visitor asked for, read from the `host` header and not
 * from the request URL. A local run, or any server that builds its request URL
 * from its own address, names that address for every host, so only the header
 * tells the school hosts apart. On Vercel, Next.js builds the URL from this same
 * header (`trustHostHeader`), so production reads the same host here. The port
 * is dropped, and a header that is not a valid host names no host at all.
 */
export function readRequestHostname(headers: Headers) {
  const host = headers.get("host");
  if (host === null || !URL.canParse(`http://${host}`)) {
    return "";
  }
  return new URL(`http://${host}`).hostname;
}

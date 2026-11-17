import { isSchoolLabel, TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { SCHOOL_CELL_DOMAINS } from "@repo/site/domains";
import { readHostname } from "@repo/utilities/http/host";
import { Array as Arr, Option, Record as Rec, Schema } from "effect";

/**
 * The domain of a local development server. Browsers resolve every
 * `*.localhost` name to loopback, so a school opens at `harapan.localhost`
 * without a hosts file.
 */
const LOCAL_DOMAIN = "localhost";

/** The cell domains of production, then the local domain for development. */
export const SCHOOL_DOMAINS = [
  ...Rec.values(SCHOOL_CELL_DOMAINS),
  LOCAL_DOMAIN,
];

/** The label of the host that names Nakafa School itself, such as `school.nakafa.com`. */
const PRODUCT_LABEL = "school";

/**
 * What a host is to the web Worker, decided from its name alone, so a request
 * never reads the database to find its school (ADR 0026):
 *
 * - `School`: one label under a school domain that names a school, such as
 *   `harapan.nakafa.com` or `harapan.localhost`.
 * - `Product`: the host of Nakafa School itself, `school.nakafa.com`.
 * - `Refused`: any other host under a production cell domain, such as `www`, a
 *   label the slug rules reserve or refuse (`isSchoolLabel`), or two labels. The
 *   Worker moves its pages to the main site, unless the host is the deployment's
 *   own address, which only the deployment knows (`readMainSiteRedirect`).
 * - `Main`: the main site, a development server, and every host outside the
 *   cell domains.
 */
const HostRole = Schema.TaggedUnion({
  Main: {},
  Product: {},
  Refused: {},
  School: { slug: TenantSlug },
});

type HostRole = typeof HostRole.Type;

/** The school domain that a host sits one or more labels under, with the labels in front of it. */
function splitHost(hostname: string) {
  return Arr.findFirst(SCHOOL_DOMAINS, (domain) =>
    hostname.endsWith(`.${domain}`)
      ? Option.some({ domain, labels: hostname.slice(0, -domain.length - 1) })
      : Option.none()
  );
}

/** Whether a domain is a production cell domain, where an unknown host is refused. */
function isCellDomain(domain: string) {
  return Arr.contains(Rec.values(SCHOOL_CELL_DOMAINS), domain);
}

/** The role of one hostname, as `HostRole` decides it. */
export function readHostRole(hostname: string): HostRole {
  return Option.match(splitHost(hostname), {
    onNone: () => HostRole.cases.Main.make({}),
    onSome: ({ domain, labels }) => {
      if (isSchoolLabel(labels)) {
        return HostRole.cases.School.make({ slug: labels });
      }
      if (!isCellDomain(domain)) {
        return HostRole.cases.Main.make({});
      }
      return labels === PRODUCT_LABEL
        ? HostRole.cases.Product.make({})
        : HostRole.cases.Refused.make({});
    },
  });
}

/**
 * The host that the visitor asked for, with its port when the `host` header names
 * one, such as `harapan.localhost:3000`. The value must name a host (see
 * `readHostname`), so a missing header, or a value that is not a host, names none.
 */
function readRequestHost(headers: Headers) {
  return Option.fromNullOr(headers.get("host")).pipe(
    Option.filter((host) => Option.isSome(readHostname(host)))
  );
}

/**
 * The hostname that the visitor asked for, read from the `host` header and not
 * from the request URL. A local run, or any server that builds its request URL
 * from its own address, names that address for every host, so only the header
 * tells the school hosts apart. A platform that builds the request URL from this
 * same header, as the deployed Worker does, gives production the same host here.
 * The port is dropped, and a missing header or a value that is not a host names
 * no host.
 */
export function readRequestHostname(headers: Headers) {
  return Option.flatMap(readRequestHost(headers), readHostname);
}

/** The role of the host that the visitor asked for (`readRequestHostname`); no host is the main site. */
export function readRequestHostRole(headers: Headers): HostRole {
  return Option.match(readRequestHostname(headers), {
    onNone: () => HostRole.cases.Main.make({}),
    onSome: readHostRole,
  });
}

/**
 * The school address that a host names, such as `harapan` for
 * `harapan.nakafa.com`, or none for any host that is not a school's.
 */
export function readSchoolSlug(hostname: string): Option.Option<TenantSlug> {
  const role = readHostRole(hostname);
  return role._tag === "School" ? Option.some(role.slug) : Option.none();
}

/**
 * The address of a school's home on its school host, such as
 * `https://harapan.nakafa.com`. Production has one cell today, so every school
 * host sits under that cell's domain.
 */
export function schoolOrigin(slug: TenantSlug) {
  return new URL(`https://${slug}.${SCHOOL_CELL_DOMAINS.us}`);
}

/**
 * The school host of a school under the domain that a host sits under or is, such
 * as `harapan.localhost` beside `localhost:3000`, or none for a host outside the
 * school domains. The router maps a path of the school tree back to it.
 */
export function schoolHostBeside(hostname: string, slug: TenantSlug) {
  return Arr.findFirst(SCHOOL_DOMAINS, (domain) =>
    hostname === domain || hostname.endsWith(`.${domain}`)
      ? Option.some(`${slug}.${domain}`)
      : Option.none()
  );
}

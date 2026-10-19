import {
  isSchoolLabel,
  type TenantSlug,
} from "@repo/backend/confect/tenancy/slug";
import {
  isSharedPath,
  withPathname,
} from "@repo/internationalization/src/rewrite";
import { Array as Arr, Option } from "effect";
import { readSchoolSlug, SCHOOL_DOMAINS } from "@/lib/routing/school/host";

/** The segment of the router tree that holds every school page. */
const SCHOOL_SEGMENT = "school";

/** The school address that a reserved label takes on the main host, so no school can be named `new`. */
const SCHOOL_START_SEGMENT = "new";

/** The domain that a host sits under, such as `nakafa.com` for `www.nakafa.com`, or none. */
function readHostDomain(hostname: string): Option.Option<string> {
  return Arr.findFirst(SCHOOL_DOMAINS, (domain) =>
    hostname === domain || hostname.endsWith(`.${domain}`)
      ? Option.some(domain)
      : Option.none()
  );
}

/**
 * The school address that a path of the school tree names, such as `harapan`
 * for `/school/harapan/exams`. The reserved start page of a main host, and a
 * label that is not a school address, name none.
 */
function readSchoolTreeSlug(
  parts: readonly string[]
): Option.Option<TenantSlug> {
  return Arr.get(parts, 1).pipe(
    Option.filter((tree) => tree === SCHOOL_SEGMENT),
    Option.flatMap(() => Arr.get(parts, 2)),
    Option.filter((label) => label !== SCHOOL_START_SEGMENT),
    Option.filter(isSchoolLabel)
  );
}

/**
 * Maps the school host `harapan.nakafa.com/exams` to the school tree at
 * `/school/harapan/exams`. Shared paths and reserved labels keep their own
 * route. The output maps the tree back to the school host of the domain that
 * the current host sits under, so a link to another school is a hard link.
 */
export const schoolRewrite = {
  input: ({ url }: { url: URL }) =>
    Option.match(readSchoolSlug(url.hostname), {
      onNone: () => url,
      onSome: (slug) =>
        isSharedPath(url.pathname)
          ? url
          : withPathname(
              url,
              `/${SCHOOL_SEGMENT}/${slug}${url.pathname === "/" ? "" : url.pathname}`
            ),
    }),
  output: ({ url }: { url: URL }) => {
    const parts = url.pathname.split("/");
    return Option.match(
      Option.all([readSchoolTreeSlug(parts), readHostDomain(url.hostname)]),
      {
        onNone: () => url,
        onSome: ([label, domain]) => {
          const next = new URL(url);
          next.hostname = `${label}.${domain}`;
          next.pathname = `/${Arr.join(Arr.drop(parts, 3), "/")}`;
          return next;
        },
      }
    );
  },
};

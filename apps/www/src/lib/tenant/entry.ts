import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option, String as Str } from "effect";
import { readSchoolSlug, SCHOOL_DOMAINS } from "@/lib/routing/school/host";

/** Reads a typed web address, or none when it cannot be one. */
const readUrl = Option.liftThrowable((text: string) => new URL(text));

/**
 * The school a person typed: a bare address such as `harapan`, the host
 * `harapan.nakafa.com`, or the whole link the school sent. What names no school,
 * a reserved label included, reads as none.
 */
export function readSchoolAddress(text: string) {
  const typed = Str.toLowerCase(Str.trim(text));
  const bare = !(Str.includes(".")(typed) || Str.includes("/")(typed));
  const link = Str.startsWith("http")(typed) ? typed : `https://${typed}`;
  return bare
    ? Arr.head(SCHOOL_DOMAINS).pipe(
        Option.flatMap((domain) => readSchoolSlug(`${typed}.${domain}`))
      )
    : Option.flatMap(readUrl(link), ({ hostname }) => readSchoolSlug(hostname));
}

/**
 * Where School leads one account: into its school whenever it has one, to opening
 * a school for an account that teaches, and otherwise to the form that finds the
 * school of a student or of a parent.
 */
export function schoolEntryOf(
  school: Option.Option<TenantSlug>,
  role: string | undefined
) {
  if (Option.isSome(school)) {
    return { _tag: "Enter", slug: school.value } as const;
  }
  return role === "teacher" || role === "administrator"
    ? ({ _tag: "Open" } as const)
    : ({ _tag: "Join", guardian: role === "parent" } as const);
}

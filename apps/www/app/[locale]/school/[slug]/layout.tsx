import { HttpClient } from "@confect/js";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TenantEntry } from "@/components/tenant/entry";
import { TenantShell } from "@/components/tenant/shell";
import { getToken } from "@/lib/auth/server";
import { httpLayer } from "@/lib/convex/http";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** A viewer the school does not list gets no school, and the page answers not found. */
const notInSchool = () => Effect.succeedNone;

/**
 * The school layout of a school host. The address names the school, so the
 * layout reads its profile without a session and ends the request when no
 * school has the address. A signed-out visitor sees the entry surface with the
 * school's name. A signed-in viewer gets the shell, and a viewer who is not a
 * member of the school, or whom the school does not admit, gets not found,
 * because school pages are private. Any other failure reaches the error
 * boundary, so an outage never looks like a missing school.
 */
export default async function SchoolLayout({
  children,
  params,
}: LayoutProps<"/[locale]/school/[slug]">) {
  const { locale: localeParam, slug: slugParam } = await params;
  if (!Schema.is(TenantSlug)(slugParam)) {
    notFound();
  }
  const slug = slugParam;
  const locale = getLocaleOrThrow(localeParam);

  const profile = await Effect.runPromise(
    HttpClient.HttpClient.pipe(
      Effect.flatMap((client) => client.query(tenancy.profile.get, { slug })),
      Effect.asSome,
      Effect.catchTag("TenantNotFound", () => Effect.succeedNone),
      Effect.provide(httpLayer())
    )
  );
  if (Option.isNone(profile)) {
    notFound();
  }

  const token = await getToken();
  if (token === undefined) {
    const t = await getTranslations({ locale, namespace: "School" });
    return (
      <TenantEntry title={t("sign-in-title", { school: profile.value.name })} />
    );
  }

  const viewer = await Effect.runPromise(
    HttpClient.HttpClient.pipe(
      Effect.flatMap((client) => client.query(tenancy.viewer.get, { slug })),
      Effect.asSome,
      Effect.catchTags({ AccessDenied: notInSchool, NotMember: notInSchool }),
      Effect.provide(httpLayer({ auth: token }))
    )
  );
  if (Option.isNone(viewer)) {
    notFound();
  }

  const role = Option.match(Arr.head(viewer.value.grants), {
    onNone: () => null,
    onSome: (grant) => grant.role.key,
  });

  return (
    <TenantShell name={profile.value.name} role={role}>
      {children}
    </TenantShell>
  );
}

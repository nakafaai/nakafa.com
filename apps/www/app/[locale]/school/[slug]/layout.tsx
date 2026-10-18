import { HttpClient } from "@confect/js";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TenantEntry } from "@/components/tenant/entry";
import { canOpenExams } from "@/components/tenant/exams/access";
import { TenantShell } from "@/components/tenant/shell";
import { getToken } from "@/lib/auth/server";
import { httpLayer } from "@/lib/convex/http";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/**
 * The proxy decides the status of a school page before it streams: a missing
 * school, a viewer who is not a member, and one the school does not admit answer
 * 404 there (`lib/routing/school/refusal.ts`, ADR 0026). This layout answers the
 * same viewers with not found as well, for a request the proxy did not check, such
 * as a client navigation. Its not-found call runs after the static shell of the
 * route, which is sent with status 200 first, so that answer shows the not-found
 * page with a 200 status.
 */
export const instant = false;

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
  const canManage = Arr.contains(viewer.value.can, "tenant.manage");

  return (
    <TenantShell
      account={viewer.value.account}
      canManage={canManage}
      canOpenExams={canOpenExams(viewer.value)}
      personName={viewer.value.person.name}
      profile={profile.value}
      role={role}
    >
      {children}
    </TenantShell>
  );
}

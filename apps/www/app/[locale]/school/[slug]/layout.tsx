import { HttpClient } from "@confect/js";
import auth from "@repo/backend/confect/_generated/refs/auth";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Effect, Option, Schema } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { TenantEntry } from "@/components/tenant/entry";
import { canOpenExams } from "@/components/tenant/exams/access";
import { TenantOutsider } from "@/components/tenant/outsider";
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

/** A signed-in viewer whom the school does not admit: the page answers not found. */
const deniedViewer = () => Effect.succeed({ _tag: "denied" as const });

/** A signed-in account that is not a member of the school: the page shows the outsider page. */
const outsiderViewer = () => Effect.succeed({ _tag: "outsider" as const });

/**
 * The public profile of the school at an address, or none when no school has it.
 * The layout and its metadata both read it, once per request.
 */
const readProfile = cache((slug: TenantSlug) =>
  Effect.runPromise(
    HttpClient.HttpClient.pipe(
      Effect.flatMap((client) => client.query(tenancy.profile.get, { slug })),
      Effect.asSome,
      Effect.catchTag("TenantNotFound", () => Effect.succeedNone),
      Effect.provide(httpLayer())
    )
  )
);

/**
 * Names every page of a school host after the school, so its tab and its history
 * entry say which school it is: the school's name alone, or a page's own title
 * before it. School pages are private, so no search engine indexes them.
 */
export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]/school/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!Schema.is(TenantSlug)(slug)) {
    return {};
  }
  return Option.match(await readProfile(slug), {
    onNone: () => ({}),
    onSome: ({ name }) => ({
      robots: { follow: false, index: false },
      title: { default: name, template: `%s | ${name}` },
    }),
  });
}

/**
 * The school layout of a school host. The address names the school, so the
 * layout reads its profile without a session and ends the request when no
 * school has the address. A signed-out visitor sees the entry surface with the
 * school's name. A signed-in viewer gets the shell. A signed-in account that is
 * not a member of the school gets the outsider page, which names the account, and
 * a viewer whom the school does not admit gets not found, because school pages are
 * private. Any other failure reaches the error boundary, so an outage never looks
 * like a missing school.
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

  const profile = await readProfile(slug);
  if (Option.isNone(profile)) {
    notFound();
  }

  const token = await getToken();
  if (token === undefined) {
    const t = await getTranslations({ locale, namespace: "School" });
    return (
      <TenantEntry
        logo={profile.value.logo}
        mascot={profile.value.mascot}
        slug={slug}
        title={t("sign-in-title", { school: profile.value.name })}
      />
    );
  }

  const membership = await Effect.runPromise(
    HttpClient.HttpClient.pipe(
      Effect.flatMap((client) => client.query(tenancy.viewer.get, { slug })),
      Effect.map((viewer) => ({ _tag: "member" as const, viewer })),
      Effect.catchTags({
        AccessDenied: deniedViewer,
        NotMember: outsiderViewer,
      }),
      Effect.provide(httpLayer({ auth: token }))
    )
  );
  if (membership._tag === "denied") {
    notFound();
  }
  if (membership._tag === "outsider") {
    const current = await Effect.runPromise(
      HttpClient.HttpClient.pipe(
        Effect.flatMap((client) => client.query(auth.queries.getCurrentUser)),
        Effect.provide(httpLayer({ auth: token }))
      )
    );
    if (current === null) {
      notFound();
    }
    // A card account's address is a placeholder, so the page names the account instead.
    const account = current.appUser.name || current.appUser.username;
    if (account === undefined) {
      notFound();
    }
    return (
      <TenantOutsider
        account={account}
        logo={profile.value.logo}
        mascot={profile.value.mascot}
        school={profile.value.name}
      />
    );
  }

  const viewer = membership.viewer;
  const role = Option.match(Arr.head(viewer.grants), {
    onNone: () => null,
    onSome: (grant) => grant.role.key,
  });
  const canManage = Arr.contains(viewer.can, "tenant.manage");

  return (
    <TenantShell
      account={viewer.account}
      canManage={canManage}
      canOpenExams={canOpenExams(viewer)}
      personName={viewer.person.name}
      profile={profile.value}
      role={role}
    >
      {children}
    </TenantShell>
  );
}

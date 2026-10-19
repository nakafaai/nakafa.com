import { HttpClient } from "@confect/js";
import auth from "@repo/backend/confect/_generated/refs/auth";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Effect, Option, Schema } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { type ReactNode, Suspense } from "react";
import { AppProviders } from "@/components/providers/app";
import { TenantEntry } from "@/components/tenant/entry";
import { canOpenExams } from "@/components/tenant/exams/access";
import { homeAccess } from "@/components/tenant/home/access";
import { TenantOutsider } from "@/components/tenant/outsider";
import { TenantShell } from "@/components/tenant/shell";
import { httpLayer } from "@/lib/convex/http";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { readProfile, readViewer } from "@/lib/tenant/read";

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
 * The proxy decides the status of a school page before it streams: a missing
 * school, a viewer who is not a member, and one the school does not admit answer
 * 404 there (`lib/routing/school/refusal.ts`, ADR 0026). This layout answers the
 * same viewers with not found as well, for a request the proxy did not check, such
 * as a client navigation. Its not-found call runs after the static shell of the
 * route, which is sent with status 200 first, so that answer shows the not-found
 * page with a 200 status.
 *
 * The school layout of a school host. The address names the school, so the
 * layout reads its profile without a session and ends the request when no
 * school has the address. A signed-out visitor sees the entry surface with the
 * school's name. A signed-in viewer gets the shell. A signed-in account that is
 * not a member of the school gets the outsider page, which names the account, and
 * a viewer whom the school does not admit gets not found, because school pages are
 * private. Any other failure reaches the error boundary, so an outage never looks
 * like a missing school.
 * The signed-in shell mounts the client providers once for the whole school, so
 * its sidebar and every page under it share one Convex session, and the pages
 * mount no providers of their own.
 */
export default function SchoolLayout({
  children,
  params,
}: LayoutProps<"/[locale]/school/[slug]">) {
  // The school's reads are request-time work, so they stream inside a boundary. The
  // route then keeps a static shell, and the frame arrives once its reads answer.
  return (
    <Suspense fallback={null}>
      <SchoolFrame params={params}>{children}</SchoolFrame>
    </Suspense>
  );
}

/**
 * The school's frame for one request: the profile and the viewer that the layout
 * reads, and the one of the outcomes that they decide.
 */
async function SchoolFrame({
  children,
  params,
}: {
  children: ReactNode;
  params: LayoutProps<"/[locale]/school/[slug]">["params"];
}) {
  // Every school page is private, so it renders for each request and never
  // prerenders. `connection()` says so before the reads, which keeps the metadata
  // and the static shell of the school out of a prerender.
  await connection();
  const { locale: localeParam, slug: slugParam } = await params;
  if (!Schema.is(TenantSlug)(slugParam)) {
    notFound();
  }
  const slug = slugParam;
  const locale = getLocaleOrThrow(localeParam);

  // The profile and the viewer are independent reads, so they start together. The
  // viewer reads the session token first, and that token is the only read it waits for.
  const [profile, viewer] = await Promise.all([
    readProfile(slug),
    readViewer(slug),
  ]);
  if (Option.isNone(profile)) {
    notFound();
  }

  if (viewer._tag === "visitor") {
    const t = await getTranslations({ locale, namespace: "School" });
    // The username form mounts its own Convex client inside its lazily loaded chunk,
    // so the signed-out tree mounts none.
    return (
      <TenantEntry
        logo={profile.value.logo}
        mascot={profile.value.mascot}
        slug={slug}
        title={t("sign-in-title", { school: profile.value.name })}
      />
    );
  }
  if (viewer._tag === "denied") {
    notFound();
  }
  if (viewer._tag === "outsider") {
    const current = await Effect.runPromise(
      HttpClient.HttpClient.pipe(
        Effect.flatMap((client) => client.query(auth.queries.getCurrentUser)),
        Effect.provide(httpLayer({ auth: viewer.token }))
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

  const member = viewer.viewer;
  const role = Option.match(Arr.head(member.grants), {
    onNone: () => null,
    onSome: (grant) => grant.role.key,
  });
  const canManage = Arr.contains(member.can, "tenant.manage");

  return (
    <AppProviders pageNavigation={null}>
      <TenantShell
        account={member.account}
        canManage={canManage}
        canOpenExams={canOpenExams(member)}
        home={homeAccess(member)}
        personName={member.person.name}
        profile={profile.value}
        role={role}
      >
        {children}
      </TenantShell>
    </AppProviders>
  );
}

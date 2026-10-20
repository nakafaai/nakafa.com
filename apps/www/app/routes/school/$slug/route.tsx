import { captureException } from "@repo/analytics/posthog/browser";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { monospace } from "@repo/design-system/lib/monospace";
import { SITE_ORIGIN } from "@repo/seo/origin";
import {
  createFileRoute,
  type ErrorComponentProps,
  notFound,
  Outlet,
} from "@tanstack/react-router";
import { cn } from "cn";
import { Effect, Option, Schema } from "effect";
import { type ReactElement, useEffect } from "react";
import { useLocale, useTranslations } from "use-intl";
import { AppProviders } from "@/components/providers/app";
import { Broken } from "@/components/state/broken";
import { Stage } from "@/components/state/stage";
import { TenantEntry } from "@/components/tenant/entry";
import { canOpenExams } from "@/components/tenant/exams/access";
import { TenantMissing } from "@/components/tenant/missing";
import { TenantOutsider } from "@/components/tenant/outsider";
import { isLostAccess } from "@/components/tenant/refusal";
import { TenantRefused } from "@/components/tenant/refused";
import { TenantShell } from "@/components/tenant/shell";
import { readShellClassesFn } from "@/lib/tenant/classes.fn";
import { canManageSchool, roleOf } from "@/lib/tenant/frame";
import { readSchoolFrameFn } from "@/lib/tenant/frame.fn";
import { schoolHead } from "@/lib/tenant/head";

/**
 * Every school document is private: it is never cached, it is not indexed, and
 * its answer depends on the visitor's cookie and language.
 */
const SCHOOL_HEADERS = {
  "cache-control": "private, no-store",
  "x-robots-tag": "noindex",
  vary: "Accept-Language, Cookie",
};

/**
 * The search params of the school entry. `masuk=username` opens the username form
 * of the entry surface. A value that does not decode reads as none, so a stale
 * link still opens the page.
 */
const SchoolSearch = Schema.Struct({
  masuk: Schema.optional(Schema.Literal("username")),
}).pipe(Schema.catchDecoding(() => Effect.succeedSome({})));

/** The school address of the path, or the not-found page when no school has it. */
function readSlug(slug: string): TenantSlug {
  const school = Schema.decodeOption(TenantSlug)(slug);
  if (Option.isNone(school)) {
    throw notFound();
  }
  return school.value;
}

/**
 * The school layout. The gate decides the page before it streams: a school that
 * does not exist, and a viewer whom the school denies, answer not found. A visitor
 * sees the entry surface, and an account that is not a member sees the outsider
 * page. A member gets the shell, and every page of the school renders inside it.
 */
export const Route = createFileRoute("/school/$slug")({
  params: {
    parse: ({ slug }) => ({ slug: readSlug(slug) }),
  },
  validateSearch: Schema.toStandardSchemaV1(SchoolSearch),
  beforeLoad: async ({ params }) => {
    const school = await readSchoolFrameFn({ data: { slug: params.slug } });
    if (school._tag === "Refused") {
      throw notFound();
    }
    return { school, slug: params.slug };
  },
  loader: ({ context }) =>
    context.school._tag === "Member"
      ? readShellClassesFn({ data: { slug: context.slug } })
      : undefined,
  head: ({ match }) => {
    const school = match.context.school;
    return school === undefined ? {} : schoolHead(school.profile.name);
  },
  headers: () => SCHOOL_HEADERS,
  component: SchoolLayout,
  errorComponent: SchoolError,
  notFoundComponent: SchoolRefused,
});

function SchoolLayout(): ReactElement {
  const { school } = Route.useRouteContext();
  const classes = Route.useLoaderData();
  if (school._tag === "Visitor") {
    return (
      <TenantEntry
        logo={school.profile.logo}
        mascot={school.profile.mascot}
        slug={school.profile.slug}
        title={school.title}
      />
    );
  }
  if (school._tag === "Outsider") {
    return (
      <TenantOutsider
        account={school.account}
        logo={school.profile.logo}
        mascot={school.profile.mascot}
        school={school.profile.name}
      />
    );
  }
  const { viewer } = school;
  return (
    <AppProviders pageNavigation={null}>
      <TenantShell
        account={viewer.account}
        canManage={canManageSchool(viewer.can)}
        canOpenExams={canOpenExams(viewer)}
        classes={classes}
        greeting={school.greeting}
        home={school.home}
        personName={viewer.person.name}
        profile={school.profile}
        role={roleOf(viewer.grants)}
        viewer={viewer}
      >
        <div className={cn(monospace, "contents")}>
          <Outlet />
        </div>
      </TenantShell>
    </AppProviders>
  );
}

/** The page of a school that the gate refused: no school has the address, or the viewer may not open it. */
function SchoolRefused(): ReactElement {
  const locale = useLocale();
  return (
    <Stage>
      <TenantMissing homeHref={new URL(`/${locale}`, SITE_ORIGIN).href} />
    </Stage>
  );
}

/**
 * Keeps a school failure on the school's own surface. A viewer who lost the
 * school sees the refused page, and any other failure sees the broken page with
 * a way to retry or to leave for Nakafa.
 */
function SchoolError({ error }: ErrorComponentProps): ReactElement {
  const t = useTranslations("Error");
  const tState = useTranslations("State");
  const locale = useLocale();
  const refused = isLostAccess(error);

  useEffect(() => {
    if (refused) {
      return;
    }
    captureException(error, { source: "school-segment-error" });
  }, [error, refused]);

  if (refused) {
    return <TenantRefused />;
  }
  return (
    <Stage>
      <Broken
        description={t("description")}
        home={tState("home-button")}
        homeHref={new URL(`/${locale}`, SITE_ORIGIN).href}
        retry={t("retry")}
        title={t("title")}
      />
    </Stage>
  );
}

import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { monospace } from "@repo/design-system/lib/monospace";
import { SITE_ORIGIN } from "@repo/seo/origin";
import {
  createFileRoute,
  type ErrorComponentProps,
  notFound,
  Outlet,
} from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { cn } from "cn";
import { Array as Arr, Effect, Option, Schema } from "effect";
import type { ReactElement } from "react";
import { useLocale, useTranslations } from "use-intl";
import { AppProviders } from "@/components/providers/app";
import { ActionLink } from "@/components/state/action";
import { Broken, BrokenRetry } from "@/components/state/broken";
import { useRouteFailure } from "@/components/state/localized";
import { Stage } from "@/components/state/stage";
import { TenantEntry } from "@/components/tenant/entry";
import { canOpenExams } from "@/components/tenant/exams/access";
import { TenantMissing } from "@/components/tenant/missing";
import { TenantOutsider } from "@/components/tenant/outsider";
import { isLostAccess } from "@/components/tenant/refusal";
import { canOpenReports } from "@/components/tenant/reports/access";
import { TenantShell } from "@/components/tenant/shell";
import { readAuthLegalFn } from "@/lib/auth/legal.functions";
import { readShellClassesFn } from "@/lib/tenant/classes.functions";
import {
  canManageSchool,
  outsiderOf,
  roleOf,
  type SchoolRead,
} from "@/lib/tenant/frame";
import { readSchoolFrameFn } from "@/lib/tenant/frame.functions";
import { schoolHead } from "@/lib/tenant/head";
import { reusesVisitFrame } from "@/lib/tenant/visit";

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

/** The legal notice of the sign-in sentence, as its server function answers it. */
type LegalRead = Awaited<ReturnType<typeof readAuthLegalFn>>;

/** The frame and the legal notice that one school visit has read so far. */
type SchoolVisit = Partial<
  Record<"legal", LegalRead> & Record<"school", SchoolRead>
>;

/**
 * Whether a run of the school's loaders draws the first HTML. On the server the Worker draws
 * it, and each page reads its first screen through its server function, so its rows are in
 * the HTML. In the browser a click reads nothing before it commits: the page commits at once
 * and reads its rows live from Convex, so no click waits on a Worker request (ADR 0038 D2).
 */
const drawsFirstHtml = createIsomorphicFn()
  .server(() => true)
  .client(() => false);

/**
 * Starts the memo of one school visit. TanStack keeps the layout's context object
 * for every navigation that keeps its match, so a child navigation reuses the
 * visit's frame. Hydration after a hard load starts a fresh memo, so the first child
 * navigation after it reads the frame once more.
 */
function startVisit() {
  const visit: SchoolVisit = {};
  return { visit };
}

/**
 * The school layout. The gate decides the page before it streams: a school that
 * does not exist, and a viewer whom the school denies, answer not found. A visitor
 * sees the entry surface, and an account that is not a member sees the outsider
 * page. A member gets the shell, and every page of the school renders inside it.
 * The layout's beforeLoad runs on every navigation into the school. A child
 * navigation reuses the visit's frame, and a refresh reads it again.
 */
export const Route = createFileRoute("/school/$slug")({
  // Leaving the school drops its memo at once, so a return to it reads the frame again.
  gcTime: 0,
  params: {
    parse: ({ slug }) => ({ slug: readSlug(slug) }),
  },
  validateSearch: Schema.toStandardSchemaV1(SchoolSearch),
  context: startVisit,
  beforeLoad: async ({ cause, context, matches, params, routeId }) => {
    const { visit } = context;
    const invalid = Arr.some(
      matches,
      (match) => match.routeId === routeId && match.invalid
    );
    const reuse = reusesVisitFrame({ cause, invalid });
    visit.school =
      reuse && visit.school !== undefined
        ? visit.school
        : await readSchoolFrameFn({ data: { slug: params.slug } });
    visit.legal =
      reuse && visit.legal !== undefined
        ? visit.legal
        : await readAuthLegalFn({ data: {} });
    if (visit.school._tag === "Refused") {
      throw notFound();
    }
    return {
      firstHtml: drawsFirstHtml(),
      legal: visit.legal,
      school: visit.school,
      slug: params.slug,
    };
  },
  // The sidebar's classes are read for the first HTML only; after that the shell reads them live.
  staleTime: Number.POSITIVE_INFINITY,
  loader: ({ context }) =>
    context.firstHtml && context.school._tag === "Member"
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
    return <TenantEntry title={school.title} />;
  }
  if (school._tag === "Outsider") {
    return (
      <TenantOutsider account={school.account} school={school.profile.name} />
    );
  }
  const { viewer } = school;
  return (
    <AppProviders pageNavigation={null}>
      <TenantShell
        account={viewer.account}
        canManage={canManageSchool(viewer.can)}
        canOpenExams={canOpenExams(viewer)}
        canOpenReports={canOpenReports(viewer)}
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
  const tState = useTranslations("State");
  return (
    <Stage>
      <TenantMissing>
        <ActionLink
          href={new URL(`/${locale}`, SITE_ORIGIN).href}
          label={tState("home-button")}
          variant="default"
        />
      </TenantMissing>
    </Stage>
  );
}

/**
 * Keeps a school failure on the school's own surface. A member whom the school
 * stopped counting while a page was open sees what a reload answers, and any
 * other failure sees the broken page with a way to retry or to leave for Nakafa.
 */
function SchoolError({ error }: ErrorComponentProps): ReactElement {
  return isLostAccess(error) ? <SchoolLeft /> : <SchoolFailure error={error} />;
}

/** The broken page of a school failure, reported once, or nothing while the page reloads for a chunk of an earlier deploy. */
function SchoolFailure({ error }: { error: unknown }): ReactElement | null {
  const t = useTranslations("Error");
  const tState = useTranslations("State");
  const locale = useLocale();
  const reloading = useRouteFailure(error, "school-segment-error");
  if (reloading) {
    return null;
  }
  return (
    <Stage>
      <Broken description={t("description")} title={t("title")}>
        <BrokenRetry>{t("retry")}</BrokenRetry>
        <ActionLink
          href={new URL(`/${locale}`, SITE_ORIGIN).href}
          label={tState("home-button")}
          variant="ghost"
        />
      </Broken>
    </Stage>
  );
}

/**
 * The page of a member whom the school stopped counting while a page was open: the outsider page
 * that a reload of the same address answers, drawn from the frame that the visit already holds, so
 * the live answer and the reload agree. Its Check again reads the frame once more. An account with
 * no name answers not found, as a reload does.
 */
function SchoolLeft(): ReactElement {
  const { school } = Route.useRouteContext();
  return Option.match(outsiderOf(school), {
    onNone: () => <SchoolRefused />,
    onSome: (outsider) => (
      <TenantOutsider
        account={outsider.account}
        school={outsider.profile.name}
      />
    ),
  });
}

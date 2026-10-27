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
import { type AuthLegalLinks, authLegalLinks } from "@/lib/auth/legal";
import { readMarketingShellFn } from "@/lib/marketing/shell.functions";
import { readStaticData } from "@/lib/static/data";
import {
  canManageSchool,
  outsiderOf,
  roleOf,
  type SchoolFrame,
  type SchoolRead,
} from "@/lib/tenant/frame";
import { schoolHead } from "@/lib/tenant/head";
import { SchoolReadsLive } from "@/lib/tenant/read";
import { readSchoolLocale } from "@/lib/tenant/root";
import { readBrowserSchoolFrame, reusesVisitFrame } from "@/lib/tenant/visit";

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

/** The frame of one school visit and the legal notice of its sign-in sentence. */
type VisitFrame = Record<"legal", AuthLegalLinks | null> &
  Record<"school", SchoolRead>;

/** The frame that one school visit has read so far. */
type SchoolVisit = Partial<Record<"frame", VisitFrame>>;

/**
 * What the layout gives every page of the school: the visit's frame, which a refused
 * school never reaches, and the school's address. The layout's `beforeLoad` names it, because the router's types are built
 * from every route's context, so a context inferred from a body that reads the router's
 * matches would depend on itself.
 */
type SchoolContext = Record<"legal", AuthLegalLinks | null> &
  Record<"school", SchoolFrame> &
  Record<"slug", TenantSlug>;

/**
 * Reads the frame of a school in the browser. A visitor's entry page names the
 * privacy and terms pages, so only a visitor reads the locale's legal pages, from
 * the static answer that the build writes for every locale.
 */
async function readVisitFrame(slug: TenantSlug): Promise<VisitFrame> {
  const locale = readSchoolLocale();
  const school = await Effect.runPromise(
    readBrowserSchoolFrame(slug, locale).pipe(Effect.provide(SchoolReadsLive))
  );
  if (school._tag !== "Visitor") {
    return { legal: null, school };
  }
  const shell = await readStaticData(readMarketingShellFn, { locale });
  return {
    legal: Option.getOrNull(authLegalLinks(locale, shell.pageNavigation)),
    school,
  };
}

/**
 * Starts the memo of one school visit. TanStack keeps the layout's context object
 * for every navigation that keeps its match, so a child navigation reuses the
 * visit's frame.
 */
function startVisit() {
  const visit: SchoolVisit = {};
  return { visit };
}

/**
 * The school layout, which renders only in the browser. The gate decides the page
 * before it commits: a school that does not exist, and a viewer whom the school
 * denies, answer not found. A visitor sees the entry surface, and an account that
 * is not a member sees the outsider page. A member gets the shell, and every page
 * of the school renders inside it. The layout's beforeLoad runs on every
 * navigation into the school. A child navigation reuses the visit's frame, so a
 * click reads nothing before it commits, and a refresh reads it again.
 */
export const Route = createFileRoute("/school/$slug")({
  // Leaving the school drops its memo at once, so a return to it reads the frame again.
  gcTime: 0,
  params: {
    parse: ({ slug }) => ({ slug: readSlug(slug) }),
  },
  validateSearch: Schema.toStandardSchemaV1(SchoolSearch),
  context: startVisit,
  beforeLoad: async ({
    cause,
    context,
    matches,
    params,
    routeId,
  }): Promise<SchoolContext> => {
    const { visit } = context;
    const invalid = Arr.some(
      matches,
      (match) => match.routeId === routeId && match.invalid
    );
    const frame =
      reusesVisitFrame({ cause, invalid }) && visit.frame !== undefined
        ? visit.frame
        : await readVisitFrame(params.slug);
    visit.frame = frame;
    if (frame.school._tag === "Refused") {
      throw notFound();
    }
    return { legal: frame.legal, school: frame.school, slug: params.slug };
  },
  head: ({ match }) => {
    const school = match.context.school;
    return school === undefined ? {} : schoolHead(school.profile.name);
  },
  component: SchoolLayout,
  errorComponent: SchoolError,
  notFoundComponent: SchoolRefused,
});

function SchoolLayout(): ReactElement {
  const { school } = Route.useRouteContext();
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

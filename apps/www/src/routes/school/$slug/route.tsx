import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { monospace } from "@repo/design-system/lib/monospace";
import type { Locale } from "@repo/internationalization/src/locale";
import { SITE_ORIGIN } from "@repo/seo/origin";
import {
  createFileRoute,
  type ErrorComponentProps,
  notFound,
  Outlet,
  useRouter,
} from "@tanstack/react-router";
import { cn } from "cn";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { type ReactElement, useEffect } from "react";
import { useLocale, useTranslations } from "use-intl";
import { AppProviders } from "@/components/providers/app";
import { ActionLink } from "@/components/state/action";
import { Broken, BrokenRetry } from "@/components/state/broken";
import { useRouteFailure } from "@/components/state/localized";
import { Stage } from "@/components/state/stage";
import { TenantEntry } from "@/components/tenant/entry";
import { canOpenExams } from "@/components/tenant/exams/access";
import { loadEntryForm } from "@/components/tenant/forms";
import { TenantMissing } from "@/components/tenant/missing";
import { TenantOutsider } from "@/components/tenant/outsider";
import { isLostAccess } from "@/components/tenant/refusal";
import { canOpenReports } from "@/components/tenant/reports/access";
import { TenantShell } from "@/components/tenant/shell";
import { reportClientException } from "@/lib/analytics/client";
import { hasSignedInHint } from "@/lib/auth/hint";
import { loadKnownSession } from "@/lib/auth/known";
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
import {
  dropKeptFrame,
  isSameFrame,
  keptFrameFor,
  loadKeptFrameText,
  saveKeptFrame,
} from "@/lib/tenant/kept";
import { SchoolReadFailed, SchoolReadsLive } from "@/lib/tenant/read";
import { readSchoolLocale } from "@/lib/tenant/root";
import { readBrowserVisit, reusesVisitFrame } from "@/lib/tenant/visit";

/**
 * The search params of the school entry. `sign-in=username` opens the username form
 * of the entry surface. A value that does not decode reads as none, so a stale
 * link still opens the page.
 */
const SchoolSearch = Schema.Struct({
  "sign-in": Schema.optional(Schema.Literal("username")),
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

/**
 * The memo of one school visit: the frame it drew, the live read that checks a kept frame it drew at once, and the
 * live frame that replaces the kept one where they differ.
 */
type SchoolVisit = Partial<
  Record<"confirmed" | "frame", VisitFrame | undefined> &
    Record<"live", Promise<VisitFrame> | undefined>
>;

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
 * Reads the frame of a school in the browser, and keeps it for the host's next visit with the session it was read
 * for; a refused school forgets the kept frame. A visitor's entry page names the privacy and terms pages from the
 * static answer that the build writes for every locale, which a read with no session takes beside the school's own
 * reads.
 */
function readVisitFrame(
  slug: TenantSlug,
  locale: Locale,
  signedIn: boolean
): Promise<VisitFrame> {
  const legal = Effect.tryPromise({
    catch: (cause) => new SchoolReadFailed({ cause }),
    try: () => readStaticData(readMarketingShellFn, { locale }),
  }).pipe(
    Effect.map((shell) =>
      Option.getOrNull(authLegalLinks(locale, shell.pageNavigation))
    )
  );
  return Effect.runPromise(
    readBrowserVisit({ legal, locale, signedIn, slug }).pipe(
      Effect.tap(({ legal: links, school, sessionId }) =>
        school._tag === "Refused"
          ? dropKeptFrame()
          : saveKeptFrame({ legal: links, school, sessionId })
      ),
      Effect.map(({ legal: links, school }) => ({ legal: links, school })),
      Effect.provide(SchoolReadsLive)
    )
  );
}

/**
 * Enters a school visit. The frame the host kept for the browser's session, in the page's locale, draws at once, and
 * the live read checks it (`useLiveVisit`); a visit with no such frame waits for the live read. The sign-in hint
 * says, before any read, whether the browser holds a session.
 */
function enterVisit(slug: TenantSlug, visit: SchoolVisit) {
  const locale = readSchoolLocale();
  const signedIn = hasSignedInHint(document.cookie);
  const live = readVisitFrame(slug, locale, signedIn);
  const kept = Effect.runSync(
    Effect.all([loadKeptFrameText(), loadKnownSession()]).pipe(
      Effect.map(([text, known]) =>
        keptFrameFor(text, { known, locale, signedIn })
      )
    )
  );
  if (Option.isNone(kept)) {
    return live;
  }
  visit.live = live;
  return Promise.resolve({
    legal: kept.value.legal,
    school: kept.value.school,
  });
}

/** Takes the live read that checks the visit's kept frame, once, so one layout checks it. */
function takeLiveRead(visit: SchoolVisit) {
  const live = visit.live;
  visit.live = undefined;
  return live;
}

/** Hands the gate's next run the live frame that replaces the kept one. */
function confirmFrame(visit: SchoolVisit, next: VisitFrame) {
  visit.confirmed = next;
}

/** The frame a navigation into the school commits: the live one that replaced a kept frame, the visit's, or a new visit's. */
function frameOfNavigation(
  visit: SchoolVisit,
  slug: TenantSlug,
  reuses: boolean
): Promise<VisitFrame> {
  if (visit.confirmed !== undefined) {
    const confirmed = visit.confirmed;
    visit.confirmed = undefined;
    return Promise.resolve(confirmed);
  }
  if (reuses && visit.frame !== undefined) {
    return Promise.resolve(visit.frame);
  }
  return enterVisit(slug, visit);
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
    search,
  }): Promise<SchoolContext> => {
    // The router loads a route's code only after its beforeLoad, so the layout's
    // code starts here, beside the frame read, and the page draws once the frame answers.
    // The entry's form, which only a visitor's or an outsider's page shows, starts beside
    // them too, since its address already names it.
    const code = Route.options.component?.preload?.();
    const entry = loadEntryForm({
      guardian: Arr.some(
        matches,
        (match) => match.routeId === "/school/$slug/parents"
      ),
      signIn: search["sign-in"],
    });
    const { visit } = context;
    const invalid = Arr.some(
      matches,
      (match) => match.routeId === routeId && match.invalid
    );
    const frame = await frameOfNavigation(
      visit,
      params.slug,
      reusesVisitFrame({ cause, invalid })
    );
    visit.frame = frame;
    if (frame.school._tag === "Refused") {
      throw notFound();
    }
    // A visitor's entry paints with its form, and so does the username form that an outsider's card
    // way opens while its account signs out.
    if (frame.school._tag === "Visitor" || frame.school._tag === "Outsider") {
      await entry;
    }
    await code;
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

/**
 * Replaces a kept frame that the visit drew at once with the live read, where they differ: the gate runs again with
 * the live frame, as a refresh does, so a name, a role or a membership that changed since the last visit shows at
 * once, and a frame that still holds keeps every node it drew. A live read that fails is reported, and the visit keeps
 * the kept frame while its pages read their own rows.
 */
function useLiveVisit() {
  const { legal, school, visit } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const live = takeLiveRead(visit);
    if (live === undefined) {
      return;
    }
    live.then(
      (next) => {
        if (
          next.school._tag !== "Refused" &&
          isSameFrame(
            { legal: next.legal, school: next.school },
            { legal, school }
          )
        ) {
          return;
        }
        confirmFrame(visit, next);
        router.invalidate();
      },
      (cause) =>
        Effect.runFork(
          reportClientException(cause, {
            operation: "revalidate",
            source: "tenant.keptFrame",
          })
        )
    );
  }, [legal, router, school, visit]);
}

function SchoolLayout(): ReactElement {
  const { school } = Route.useRouteContext();
  useLiveVisit();
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

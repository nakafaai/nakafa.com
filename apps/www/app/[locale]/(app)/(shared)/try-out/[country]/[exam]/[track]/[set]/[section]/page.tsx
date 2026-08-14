import { Effect } from "effect";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache, Suspense } from "react";
import {
  createRetainedTryoutMetadata,
  generateTryoutRouteMetadata,
} from "@/components/tryout/catalog/metadata";
import {
  readTryoutSectionAttemptPage,
  readTryoutSectionPage,
} from "@/components/tryout/catalog/server";
import { loadSignedTryoutContent } from "@/components/tryout/content/signed";
import { TryoutReview } from "@/components/tryout/review/server";
import { selectTryoutSectionReturnHref } from "@/components/tryout/route/owner";
import {
  getTryoutAttemptAuthHref,
  getTryoutAttemptHref,
  getTryoutHref,
  getTryoutPublicPathHref,
  readTryoutRouteAttemptCapability,
  type TryoutRouteSearchParams,
} from "@/components/tryout/route/path";
import { TryoutSectionPageClient } from "@/components/tryout/section/client";
import { getToken } from "@/lib/auth/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";

interface TryoutSectionParams {
  country: string;
  exam: string;
  locale: string;
  section: string;
  set: string;
  track: string;
}

interface TryoutSectionPageProps {
  params: Promise<TryoutSectionParams>;
  searchParams: Promise<TryoutRouteSearchParams>;
}

/** Builds route-owned metadata for one localized try-out section. */
export async function generateMetadata({
  params,
  searchParams,
}: TryoutSectionPageProps) {
  const {
    country,
    exam,
    locale: localeParam,
    section,
    set,
    track,
  } = await params;
  const capability = readTryoutRouteAttemptCapability(await searchParams);
  if (capability.kind === "invalid") {
    notFound();
  }
  const attemptId =
    capability.kind === "valid" ? capability.attemptId : undefined;
  const locale = getLocaleOrThrow(localeParam);
  const publicPath = getTryoutHref({
    country,
    exam,
    section,
    set,
    track,
  }).slice(1);
  const resolved = await readRoutePage(locale, publicPath, attemptId);

  if (resolved.authRequired) {
    const tTryouts = await getTranslations({ locale, namespace: "Tryouts" });
    return createRetainedTryoutMetadata({
      description: tTryouts("metadata-description"),
      title: tTryouts("title"),
    });
  }
  if (resolved.attemptPage?.kind === "retained") {
    return createRetainedTryoutMetadata({
      description: resolved.attemptPage.page.section.description,
      title: resolved.attemptPage.page.section.title,
    });
  }
  if (resolved.publicPage) {
    return generateTryoutRouteMetadata({
      kind: "section",
      locale,
      publicPath,
    });
  }
  notFound();
}

/** Renders one try-out section with public metadata and owned runtime content. */
export default function Page(props: TryoutSectionPageProps) {
  return (
    <Suspense fallback={null}>
      <TryoutSectionRoute
        params={props.params}
        searchParams={props.searchParams}
      />
    </Suspense>
  );
}

/** Resolves one cached public section inside its route-owned boundary. */
async function TryoutSectionRoute({
  params,
  searchParams,
}: TryoutSectionPageProps) {
  const {
    country,
    exam,
    locale: localeParam,
    section,
    set,
    track,
  } = await params;
  const capability = readTryoutRouteAttemptCapability(await searchParams);
  if (capability.kind === "invalid") {
    notFound();
  }
  const attemptId =
    capability.kind === "valid" ? capability.attemptId : undefined;
  const locale = getLocaleOrThrow(localeParam);
  const sectionPath = getTryoutHref({
    country,
    exam,
    section,
    set,
    track,
  }).slice(1);
  const resolved = await readRoutePage(locale, sectionPath, attemptId);
  if (resolved.authRequired && attemptId) {
    redirect(getTryoutAttemptAuthHref(locale, sectionPath, attemptId));
  }
  if (resolved.authRequired) {
    notFound();
  }
  const { attemptPage } = resolved;
  if (attemptPage?.kind === "redirect") {
    redirect(
      getTryoutAttemptHref(attemptPage.publicPath, attemptPage.attemptId)
    );
  }
  if (attemptId && !attemptPage) {
    notFound();
  }
  const page = attemptPage?.page ?? resolved.publicPage;

  if (!page) {
    notFound();
  }

  const setHref = selectTryoutSectionReturnHref({
    attemptPage,
    publicHref: getTryoutHref({ country, exam, set, track }),
  });

  const signedContent =
    attemptPage?.content.kind === "signed"
      ? Effect.runPromise(loadSignedTryoutContent(attemptPage.content))
      : null;
  const reviewRuntime =
    attemptPage?.content.kind === "signed" &&
    attemptPage.content.answers.length > 0
      ? attemptPage.initialState.runtime
      : null;

  return (
    <TryoutSectionPageClient
      binding={
        attemptPage
          ? {
              attemptId: attemptPage.attemptId,
              initialState: attemptPage.initialState,
              startHref: attemptPage.activeSectionPublicPath
                ? getTryoutPublicPathHref(attemptPage.activeSectionPublicPath)
                : null,
            }
          : null
      }
      content={reviewRuntime ? null : signedContent}
      page={page}
      route={{ country, exam, locale, section, set, track }}
      setHref={setHref}
    >
      {signedContent && reviewRuntime ? (
        <TryoutReview content={signedContent} runtime={reviewRuntime} />
      ) : null}
    </TryoutSectionPageClient>
  );
}

/** Resolves active public content or one explicitly owned frozen attempt. */
const readRoutePage = cache(
  async (
    locale: ReturnType<typeof getLocaleOrThrow>,
    publicPath: string,
    attemptId?: string
  ) => {
    if (attemptId) {
      const token = await getToken();
      if (!token) {
        return {
          attemptPage: null,
          authRequired: true,
          publicPage: null,
        };
      }
      const attemptPage = await Effect.runPromise(
        readTryoutSectionAttemptPage(token, {
          attemptId,
          kind: "retained",
          locale,
          publicPath,
        })
      );
      return {
        attemptPage,
        authRequired: false,
        publicPage: null,
      };
    }

    const [publicPage, token] = await Promise.all([
      readTryoutSectionPage(locale, publicPath),
      getToken(),
    ]);
    if (!token) {
      return {
        attemptPage: null,
        authRequired: false,
        publicPage,
      };
    }

    if (!publicPage) {
      return {
        attemptPage: null,
        authRequired: false,
        publicPage,
      };
    }
    const attemptPage = await Effect.runPromise(
      readTryoutSectionAttemptPage(token, {
        countryKey: publicPage.set.countryKey,
        examKey: publicPage.set.examKey,
        kind: "current",
        locale,
        sectionKey: publicPage.section.sectionKey,
        setKey: publicPage.set.setKey,
        trackKey: publicPage.set.trackKey,
      })
    );
    return { attemptPage, authRequired: false, publicPage };
  }
);

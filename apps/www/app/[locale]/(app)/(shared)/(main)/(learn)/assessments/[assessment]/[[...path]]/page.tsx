import { TestTubeIcon } from "@hugeicons/core-free-icons";
import { listPublicAssessmentRoutesEffect } from "@repo/contents/_types/route/projection";
import { Effect } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { SubjectItem, SubjectList } from "@/components/shared/subject-list";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createProjectedRouteAlternates } from "@/lib/utils/seo/alternates";

type AssessmentPageProps =
  PageProps<"/[locale]/assessments/[assessment]/[[...path]]">;

const ASSESSMENT_ROUTES = Effect.runSync(listPublicAssessmentRoutesEffect());

/**
 * Builds assessment context params from projected assessment route rows.
 *
 * Assessment context pages are navigation surfaces. Practice question bodies
 * remain canonical under the practice route projection.
 */
export function generateStaticParams() {
  return ASSESSMENT_ROUTES.map((route) => {
    const [, assessment, ...path] = route.publicPath.split("/");

    return path.length > 0 ? { assessment, path } : { assessment };
  });
}

/**
 * Generates metadata for one assessment context node.
 *
 * The projection owns localized slugs and route alternates, including the rule
 * that assessment year appears exactly once in public URLs.
 */
export async function generateMetadata({
  params,
}: AssessmentPageProps): Promise<Metadata> {
  const { locale, route } = await getAssessmentRoute(params);
  const path = `/${locale}/${route.publicPath}`;
  const description = route.description ?? route.title;

  return {
    title: { absolute: route.title },
    description,
    alternates: createProjectedRouteAlternates(route, ASSESSMENT_ROUTES),
    ...getSocialMetadata({
      title: route.title,
      description,
      locale,
      path,
      image: getOgUrl(locale, route.publicPath),
    }),
  };
}

/**
 * Renders an assessment context node with child context or practice links.
 *
 * Nodes with a canonical practice path link to the canonical route instead of
 * duplicating the practice body in the context page.
 */
export default async function Page({ params }: AssessmentPageProps) {
  const { locale, route } = await getAssessmentRoute(params);
  const childRoutes = ASSESSMENT_ROUTES.filter(
    (child) => child.locale === locale && child.parentPath === route.publicPath
  );

  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <HeaderContent
          description={route.description}
          icon={TestTubeIcon}
          title={route.title}
        />
        <LayoutContent>
          <SubjectList>
            {route.canonicalPath && (
              <SubjectItem
                href={`/${locale}/${route.canonicalPath}`}
                icon={TestTubeIcon}
                label={route.title}
              />
            )}
            {childRoutes.map((child) => (
              <SubjectItem
                href={`/${locale}/${child.publicPath}`}
                icon={TestTubeIcon}
                key={child.publicPath}
                label={child.title}
              />
            ))}
          </SubjectList>
        </LayoutContent>
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}

/**
 * Resolves localized assessment params through schema-owned route projection.
 *
 * Invalid combinations fail with `notFound()` at the framework boundary rather
 * than creating compatibility redirects or fallback slug behavior.
 */
async function getAssessmentRoute(params: AssessmentPageProps["params"]) {
  const { locale: rawLocale, assessment, path } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const routePath = [assessment, ...(path ?? [])].join("/");
  const route = ASSESSMENT_ROUTES.find(
    (candidate) =>
      candidate.locale === locale &&
      getPathWithoutNamespace(candidate.publicPath) === routePath
  );

  if (!route) {
    notFound();
  }

  return { locale, route };
}

/** Removes the localized route namespace from one projected public path. */
function getPathWithoutNamespace(publicPath: string) {
  return publicPath.split("/").slice(1).join("/");
}

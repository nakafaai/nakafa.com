import { TestTubeIcon } from "@hugeicons/core-free-icons";
import { listPublicAssessmentRoutes } from "@repo/contents/_types/route/assessment";
import {
  comparePublicRouteOrder,
  readPathWithoutNamespace,
} from "@repo/contents/_types/route/path";
import type { PublicAssessmentRoute } from "@repo/contents/_types/route/schema";
import { Effect } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { SubjectItem } from "@/components/shared/subject-item";
import { SubjectList } from "@/components/shared/subject-list";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createProjectedRouteAlternates } from "@/lib/utils/seo/alternates";

type AssessmentPageProps =
  PageProps<"/[locale]/assessments/[assessment]/[[...path]]">;

let assessmentRouteCache: readonly PublicAssessmentRoute[] | undefined;

/** Lazily decodes assessment context rows at the Next framework boundary. */
function readAssessmentRoutes() {
  if (assessmentRouteCache) {
    return assessmentRouteCache;
  }

  assessmentRouteCache = Effect.runSync(listPublicAssessmentRoutes());

  return assessmentRouteCache;
}

/**
 * Builds assessment context params from projected assessment route rows.
 *
 * Assessment context pages are navigation surfaces. Practice question bodies
 * remain canonical under the practice route projection.
 */
export function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  const locale = getLocaleOrThrow(params.locale);
  const staticParams: { assessment: string; path?: string[] }[] = [];

  for (const route of readAssessmentRoutes()) {
    if (route.locale !== locale) {
      continue;
    }

    const [, assessment, ...path] = route.publicPath.split("/");

    staticParams.push(path.length > 0 ? { assessment, path } : { assessment });
  }

  return staticParams;
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
  const { locale, route, routes } = await getAssessmentRoute(params);
  const path = `/${locale}/${route.publicPath}`;
  const description = route.description ?? route.title;

  return {
    title: { absolute: route.title },
    description,
    alternates: createProjectedRouteAlternates(route, routes),
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
  const { locale, route, routes } = await getAssessmentRoute(params);
  const childRoutes = routes
    .filter(
      (child) =>
        child.locale === locale && child.parentPath === route.publicPath
    )
    .sort(comparePublicRouteOrder);

  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <HeaderContent
          description={route.description}
          icon={TestTubeIcon}
          title={route.title}
        />
        <p className="sr-only">
          {locale === "id"
            ? "Pilih latihan yang tersedia untuk membuka set soal atau halaman latihan yang sesuai."
            : "Choose an available practice entry to open the matching question set or practice page."}
        </p>
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
 * than creating alternate route aliases or inferred slug behavior.
 */
async function getAssessmentRoute(params: AssessmentPageProps["params"]) {
  const { locale: rawLocale, assessment, path } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const routePath = [assessment, ...(path ?? [])].join("/");
  const routes = readAssessmentRoutes();
  const route = routes.find(
    (candidate) =>
      candidate.locale === locale &&
      readPathWithoutNamespace(candidate.publicPath) === routePath
  );

  if (!route) {
    notFound();
  }

  return { locale, route, routes };
}

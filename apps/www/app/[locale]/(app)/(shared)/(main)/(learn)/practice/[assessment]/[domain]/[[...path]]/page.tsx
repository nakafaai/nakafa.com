import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPracticeMetadataData,
  getPracticeRouteData,
  listPracticeStaticParams,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/data";
import { PracticeDomainPage } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/domain";
import {
  readPracticeRouteAlternates,
  readPracticeRoutes,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/routes";
import { PracticeSetPage } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/set";
import { SinglePracticePage } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/single";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import {
  createLocalizedAlternates,
  createProjectedRouteAlternates,
} from "@/lib/utils/seo/alternates";
import { generateSEOMetadata } from "@/lib/utils/seo/generator";

type PracticePageProps =
  PageProps<"/[locale]/practice/[assessment]/[domain]/[[...path]]">;

/** Builds static practice params from projected public exercise set rows. */
export function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  return listPracticeStaticParams(params.locale);
}

/**
 * Generates metadata for restored practice domain, set, and question pages.
 *
 * Concrete set/question pages use projected route alternates. Domain pages are
 * navigation surfaces over set rows, so they use their localized public href.
 */
export async function generateMetadata({
  params,
}: PracticePageProps): Promise<Metadata> {
  const data = await getPracticeMetadataData(params);
  const seo = await generateSEOMetadata(data.seoContext, data.locale);
  const title = seo.title;
  const description = seo.description;
  const publicPath =
    data.kind === "domain" ? data.publicPath : data.route.publicPath;
  const path = `/${data.locale}/${publicPath}`;
  const projectedAlternates =
    data.kind === "domain"
      ? []
      : readPracticeRouteAlternates(data.route, readPracticeRoutes());
  const alternates =
    data.kind === "domain"
      ? createLocalizedAlternates(path, {
          languages: Object.fromEntries(
            data.alternatePaths.map((alternate) => [
              alternate.locale,
              `/${alternate.locale}/${alternate.publicPath}`,
            ])
          ),
        })
      : createProjectedRouteAlternates(data.route, projectedAlternates, {
          types: { "text/markdown": `${path}.md` },
        });

  return {
    title: { absolute: title },
    description,
    alternates,
    ...getSocialMetadata({
      title,
      description,
      locale: data.locale,
      path,
      image: getOgUrl(data.locale, publicPath),
      type: "article",
    }),
  };
}

/** Selects the restored practice page variant for the canonical practice URL. */
export default async function Page({ params }: PracticePageProps) {
  const data = await getPracticeRouteData(params);

  switch (data.kind) {
    case "single":
      return <SinglePracticePage data={data} locale={data.locale} />;
    case "set":
      return <PracticeSetPage data={data} locale={data.locale} />;
    case "domain":
      return <PracticeDomainPage data={data} locale={data.locale} />;
    default:
      notFound();
  }
}

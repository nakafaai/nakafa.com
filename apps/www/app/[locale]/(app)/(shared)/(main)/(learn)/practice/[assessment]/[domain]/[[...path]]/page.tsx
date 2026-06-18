import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPracticeRouteData,
  listPracticeStaticParams,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/data";
import { PracticeGroupPage } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/group";
import {
  PRACTICE_ROUTES,
  readPracticeRouteAlternates,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/routes";
import { PracticeSetPage } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/set";
import { SinglePracticePage } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/single";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import {
  createLocalizedAlternates,
  createProjectedRouteAlternates,
} from "@/lib/utils/seo/alternates";

type PracticePageProps =
  PageProps<"/[locale]/practice/[assessment]/[domain]/[[...path]]">;

/** Builds static practice params from projected public exercise set rows. */
export function generateStaticParams() {
  return listPracticeStaticParams();
}

/**
 * Generates metadata for restored practice group, set, and question pages.
 *
 * Concrete set/question pages use projected route alternates. Group pages are
 * navigation surfaces over set rows, so they use their localized public href.
 */
export async function generateMetadata({
  params,
}: PracticePageProps): Promise<Metadata> {
  const data = await getPracticeRouteData(params);
  const title =
    data.kind === "year-group" ? data.group.material.title : data.route.title;
  const description =
    data.kind === "year-group"
      ? (data.group.material.description ?? title)
      : (data.route.description ?? title);
  const publicPath =
    data.kind === "year-group" ? data.publicPath : data.route.publicPath;
  const path = `/${data.locale}/${publicPath}`;
  const projectedAlternates =
    data.kind === "year-group"
      ? []
      : readPracticeRouteAlternates(data.route, PRACTICE_ROUTES);
  const alternates =
    data.kind === "year-group"
      ? createLocalizedAlternates(path, {
          languages: Object.fromEntries(
            data.group.alternatePaths.map((alternate) => [
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
    case "year-group":
      return <PracticeGroupPage data={data} locale={data.locale} />;
    default:
      notFound();
  }
}

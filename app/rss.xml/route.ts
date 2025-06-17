import { routing } from "@/i18n/routing";
import { getSlugPath as getArticleSlugPath } from "@/lib/utils/articles/slug";
import { getContent } from "@/lib/utils/contents";
import { getSlugPath as getSubjectSlugPath } from "@/lib/utils/subject/slug";
import { getStaticParams } from "@/lib/utils/system";
import type { Article, ContentTask, Subject } from "@/types/llms";
import { Feed } from "feed";
import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";

export const revalidate = false;

const baseUrl = "https://nakafa.com";

export async function GET() {
  const locales = routing.locales;

  const [t, tCommon] = await Promise.all([
    getTranslations({
      namespace: "Metadata",
      locale: routing.defaultLocale,
    }),
    getTranslations({
      namespace: "Common",
      locale: routing.defaultLocale,
    }),
  ]);

  // Get all static params
  const articles = getStaticParams({
    basePath: "contents/articles",
    paramNames: ["category", "slug"],
    slugParam: "slug",
    isDeep: true,
  }) as Article[];

  const subjects = getStaticParams({
    basePath: "contents/subject",
    paramNames: ["category", "grade", "material", "slug"],
    slugParam: "slug",
    isDeep: true,
  }) as Subject[];

  // Create all content fetching tasks
  const contentTasks: ContentTask[] = [];

  // Add article tasks
  for (const locale of locales) {
    for (const article of articles) {
      const filePath = getArticleSlugPath(article.category, article.slug);
      contentTasks.push({
        locale,
        filePath,
        section: "Articles",
      });
    }
  }

  // Add subject tasks
  for (const locale of locales) {
    for (const subject of subjects) {
      const filePath = getSubjectSlugPath(
        subject.category,
        subject.grade,
        subject.material,
        subject.slug
      );
      contentTasks.push({
        locale,
        filePath,
        section: "Subjects",
      });
    }
  }

  const contentPromises = contentTasks.map(async (task) => {
    const content = await getContent(task.locale, task.filePath);
    if (content) {
      return {
        section: task.section,
        entry: {
          title: content.metadata.title,
          description: content.metadata.description ?? content.metadata.title,
          link: `${baseUrl}/${task.locale}${task.filePath}`,
          date: new Date(content.metadata.date),
          id: `/${task.locale}${task.filePath}`,
          author: content.metadata.authors,
          language: task.locale,
        },
      };
    }
    return null;
  });

  const contentResults = await Promise.all(contentPromises);

  const feed = new Feed({
    title: t("title"),
    description: t("description"),
    id: `${baseUrl}`,
    link: `${baseUrl}`,
    language: routing.defaultLocale,
    image: `${baseUrl}/og.png`,
    favicon: `${baseUrl}/icon.png`,
    copyright: tCommon("copyright", { year: new Date().getFullYear() }),
  });

  // clean up content results
  const cleanedContents = contentResults.filter((result) => result !== null);

  for (const content of cleanedContents.sort((a, b) => {
    return new Date(b.entry.date).getTime() - new Date(a.entry.date).getTime();
  })) {
    feed.addItem(content.entry);
  }

  return new NextResponse(feed.rss2());
}

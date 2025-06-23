import { getSlugPath as getArticleSlugPath } from "@repo/contents/_lib/articles/slug";
import { getSlugPath as getSubjectSlugPath } from "@repo/contents/_lib/subject/slug";
import { getContent } from "@repo/contents/_lib/utils";
import { routing } from "@repo/internationalization/src/routing";
import { NextResponse } from "next/server";
import { getStaticParams } from "@/lib/utils/system";
import { ArticleSchema, type ContentTask, SubjectSchema } from "@/types/llms";

export const revalidate = false;

export async function GET() {
  const locales = routing.locales;
  const scanned: string[] = [];
  scanned.push("# Nakafa Content");

  // Get all static params
  const articles = getStaticParams({
    basePath: "articles",
    paramNames: ["category", "slug"],
    slugParam: "slug",
    isDeep: true,
  });

  const subjects = getStaticParams({
    basePath: "subject",
    paramNames: ["category", "grade", "material", "slug"],
    slugParam: "slug",
    isDeep: true,
  });

  // parse articles and subjects
  const { data: parsedArticles } = ArticleSchema.array().safeParse(articles);
  const { data: parsedSubjects } = SubjectSchema.array().safeParse(subjects);

  if (!(parsedArticles && parsedSubjects)) {
    return new NextResponse("Internal Server Error. Please try again later.", {
      status: 500,
    });
  }

  // Create all content fetching tasks
  const contentTasks: ContentTask[] = [];

  // Add article tasks
  for (const locale of locales) {
    for (const article of parsedArticles) {
      const filePath = getArticleSlugPath(
        article.category,
        article.slug.join("/")
      );
      contentTasks.push({
        locale,
        filePath,
        section: "Articles",
      });
    }
  }

  // Add subject tasks
  for (const locale of locales) {
    for (const subject of parsedSubjects) {
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

  // Fetch all content in parallel
  const contentPromises = contentTasks.map(async (task) => {
    const content = await getContent(task.locale, task.filePath);
    if (content) {
      return {
        section: task.section,
        entry: `- [${content.metadata.title}](/${task.locale}${task.filePath}): ${
          content.metadata.description ?? content.metadata.title
        }`,
      };
    }
    return null;
  });

  const contentResults = await Promise.all(contentPromises);

  // Group results by section
  const map = new Map<string, string[]>();

  for (const result of contentResults) {
    if (result) {
      const list = map.get(result.section) ?? [];
      list.push(result.entry);
      map.set(result.section, list);
    }
  }

  // Build final output
  for (const [key, value] of map) {
    scanned.push(`## ${key}`);
    scanned.push(value.join("\n"));
  }

  return new Response(scanned.join("\n\n"));
}

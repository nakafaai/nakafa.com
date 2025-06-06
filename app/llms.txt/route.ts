import { routing } from "@/i18n/routing";
import { getSlugPath as getArticleSlugPath } from "@/lib/utils/articles/slug";
import { getContent } from "@/lib/utils/contents";
import { getSlugPath as getSubjectSlugPath } from "@/lib/utils/subject/slug";
import { getStaticParams } from "@/lib/utils/system";
import type { ArticleCategory } from "@/types/articles/category";
import type { SubjectCategory } from "@/types/subject/category";
import type { Grade } from "@/types/subject/grade";
import type { MaterialGrade } from "@/types/subject/material";

export const revalidate = false;

type Article = {
  category: ArticleCategory;
  slug: string;
};

type Subject = {
  category: SubjectCategory;
  grade: Grade;
  material: MaterialGrade;
  slug: string[];
};

type ContentTask = {
  locale: (typeof routing.locales)[number];
  filePath: string;
  section: string;
};

export async function GET() {
  const locales = routing.locales;
  const scanned: string[] = [];
  scanned.push("# Nakafa Content");

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

  // Fetch all content in parallel
  const contentPromises = contentTasks.map(async (task) => {
    const content = await getContent(task.locale, task.filePath);
    if (content) {
      return {
        section: task.section,
        entry: `- [${content.metadata.title}](${task.locale}${task.filePath}): ${
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

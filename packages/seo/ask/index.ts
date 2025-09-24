import { buildArticles } from "@repo/seo/ask/articles/builder";
import { buildSubjects } from "@repo/seo/ask/subject/builder";

export function askSeo() {
  const articles = buildArticles();
  const subjects = buildSubjects();
  return [...articles, ...subjects];
}

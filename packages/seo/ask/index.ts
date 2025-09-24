import { buildArticles } from "@repo/seo/ask/articles/builder";

export function askSeo() {
  const articles = buildArticles();

  return [...articles];
}

import { politicsData } from "@repo/seo/ask/articles/politics/data";

export function buildArticles() {
  const articles = [...politicsData];

  return articles.map((article) => ({
    ...article,
    type: "articles",
  }));
}

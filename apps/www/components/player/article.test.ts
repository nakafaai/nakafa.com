import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  ARTICLES_SELECTOR,
  findArticle,
  readArticleKey,
} from "@/components/player/article";

describe("player articles", () => {
  it("finds the article of a question by its key", () => {
    document.body.innerHTML = `
      <section id="list">
        <article data-player-key="first"></article>
        <article data-player-key="a.b:c" id="odd"></article>
      </section>`;
    const list = document.getElementById("list");

    expect(
      Option.map(findArticle(list, "a.b:c"), (article) => article.id)
    ).toEqual(Option.some("odd"));
    expect(findArticle(list, "missing")).toEqual(Option.none());
    expect(findArticle(null, "first")).toEqual(Option.none());
    expect(list?.querySelectorAll(ARTICLES_SELECTOR)).toHaveLength(2);
  });

  it("reads the key that an article carries", () => {
    const article = document.createElement("article");
    article.setAttribute("data-player-key", "first");

    expect(readArticleKey(article)).toEqual(Option.some("first"));
    expect(readArticleKey(document.createElement("article"))).toEqual(
      Option.none()
    );
  });
});

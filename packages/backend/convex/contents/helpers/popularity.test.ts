import { mergePopularAudioContentItems } from "@repo/backend/convex/contents/helpers/popularity";
import { getTestAudioContent } from "@repo/backend/convex/test.helpers";
import { describe, expect, it } from "vitest";

const subjectRoute =
  "material/lesson/mathematics/vector-operations/vector-addition";
const articleRoute = "articles/politics/dynastic-politics-asian-values";

describe("contents/helpers/popularity", () => {
  it("keeps the highest-view source row for one graph learning object and filters low-volume items", () => {
    const englishSubject = getTestAudioContent({
      contentHash: "hash-en-low",
      locale: "en",
      route: subjectRoute,
    });
    const indonesianSubject = getTestAudioContent({
      contentHash: "hash-id-high",
      locale: "id",
      route: subjectRoute,
    });
    const article = getTestAudioContent({
      contentHash: "hash-article",
      locale: "en",
      route: articleRoute,
    });

    const items = mergePopularAudioContentItems([
      {
        sourceContent: englishSubject,
        viewCount: 20,
      },
      {
        sourceContent: indonesianSubject,
        viewCount: 35,
      },
      {
        sourceContent: article,
        viewCount: 9,
      },
    ]);

    expect(items).toEqual([
      {
        sourceContent: indonesianSubject,
        viewCount: 35,
      },
    ]);
  });
});

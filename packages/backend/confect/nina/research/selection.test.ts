import { describe, expect, it } from "@effect/vitest";
import { selectRelevantContent } from "@repo/backend/confect/nina/research/selection";
import { Array as Arr } from "effect";

/**
 * One page per case, with the task a learner writes about it as a single
 * sentence. Only the `relevant` paragraph answers the task; the others share at
 * most a few words with it. Japanese and Thai are written without spaces, so
 * only the platform can tell where their words end. In the last two pages the
 * task is made of common words (the particles の and と, or "I", "do" and "my"):
 * the other paragraphs are full of them, and only the answer holds the rare
 * ones. `maxLength` is shorter than the page and longer than the answer.
 */
const pages = [
  {
    language: "Japanese",
    task: "微分方程式の安定性とリャプノフ関数について知りたい",
    before: [
      "この記事では、学校の理科と数学で使う基本的な考え方を短く紹介します。",
      "料理では、材料を切る順番と火を通す時間が大切です。",
    ],
    relevant:
      "微分方程式の安定性は、解が小さな乱れのあとで元の状態に戻るかどうかで決まります。リャプノフ関数を使うと、解を求めずに安定性を確かめられます。",
    after: [
      "歴史の授業では、年表を使って出来事の順番を整理します。",
      "図書館では、本を借りる前に貸出期間を確認してください。",
      "最後に、これまでの内容を復習する問題を解いてみましょう。",
    ],
    maxLength: 150,
  },
  {
    language: "Thai",
    task: "วิธีเลี้ยงปลาทองให้อยู่ได้นาน",
    before: [
      "บทความนี้รวบรวมเรื่องน่ารู้เกี่ยวกับสัตว์เลี้ยงในบ้านสำหรับผู้เริ่มต้น",
      "การเดินทางไปเชียงใหม่ด้วยรถไฟใช้เวลานานมาก แต่ผู้โดยสารได้ชมวิวสวยงามอยู่นานตลอดทาง",
    ],
    relevant:
      "ปลาทองเป็นปลาที่เลี้ยงง่าย ควรเปลี่ยนน้ำทุกสัปดาห์และให้อาหารพอดี เพื่อให้ปลาอยู่ได้นานหลายปี",
    after: [
      "ร้านกาแฟแห่งนี้เปิดมาหลายปีและมีลูกค้าประจำจำนวนมาก",
      "ก่อนยืมหนังสือจากห้องสมุด ควรตรวจสอบวันกำหนดคืนทุกครั้ง",
      "สุดท้ายลองทำแบบฝึกหัดทบทวนเนื้อหาที่ผ่านมา",
    ],
    maxLength: 150,
  },
  {
    language: "English",
    task: "How does the stability of a differential equation depend on a Lyapunov function?",
    before: [
      "This guide introduces the basic ideas that students meet in school science and mathematics.",
      "Cooking depends on preparing the ingredients and watching the time that each dish needs.",
    ],
    relevant:
      "The stability of a differential equation depends on whether its solution returns to the original state after a small disturbance. A Lyapunov function checks this stability without solving the equation.",
    after: [
      "In history lessons, a timeline helps students put events in order.",
      "Before borrowing a book from the library, check the due date.",
      "Finally, try a few review exercises on the topics above.",
    ],
    maxLength: 300,
  },
  {
    language: "Japanese, task of particles",
    task: "微分方程式の安定性とリャプノフ関数について知りたい",
    before: [
      "私の家の近くにある古い店では、毎朝、近所の人が犬と散歩をして、季節の花を眺めています。",
      "友達の家で開かれた夕食会では、母の作った料理と、父の好きな酒が並びました。",
      "町の図書館の本は、子どもの頃の思い出と、今の暮らしを結びつけてくれます。",
    ],
    relevant: "リャプノフ関数で、安定性を確かめる方法を説明します。",
    after: [],
    maxLength: 140,
  },
  {
    language: "English, task of common words",
    task: "How do I reset my password?",
    before: [
      "I do not know my plan, and I think I will do it later.",
      "I do my homework after school, and my brother helps me when I get stuck.",
      "My sister and I do the dishes, and I dry them with my towel.",
      "Do you think I should call my aunt? I do not mind either way.",
      "Rain fell all afternoon, so we stayed inside and played cards.",
    ],
    relevant: "To reset your password, open the account settings page.",
    after: [],
    maxLength: 200,
  },
];

/** Writes a page the way it reads: a blank line between its paragraphs. */
function writePage({ after, before, relevant }: (typeof pages)[number]) {
  return Arr.join([...before, relevant, ...after], "\n\n");
}

/**
 * Selects the one paragraph nearest to the query from a page that is longer
 * than `maxLength`.
 */
function pickParagraph(
  paragraphs: readonly string[],
  maxLength: number,
  query: string
) {
  return selectRelevantContent({
    content: Arr.join(paragraphs, "\n\n"),
    maxLength,
    maxRelevantParagraphs: 1,
    preserveStructure: false,
    query,
  });
}

describe("selectRelevantContent", () => {
  it("returns empty content unchanged", () => {
    expect(selectRelevantContent({ content: "   " })).toBe("");
  });

  it("returns short content without truncation", () => {
    expect(selectRelevantContent({ content: "Short content." })).toBe(
      "Short content."
    );
  });

  it("keeps bounded content intact when a query is present", () => {
    expect(
      selectRelevantContent({
        content: "Intro paragraph.\n\nCaptured data includes tool calls.",
        maxLength: 100,
        query: "tool calls",
      })
    ).toBe("Intro paragraph.\n\nCaptured data includes tool calls.");
  });

  it("falls back to content truncation when a query holds no word", () => {
    expect(
      selectRelevantContent({
        content: "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.",
        maxLength: 30,
        query: "?! ... --",
      })
    ).toBe("First paragraph.\n\nSecond parag...");
  });

  it("keeps short two-paragraph content intact", () => {
    expect(
      selectRelevantContent({
        content: "Alpha intro.\n\nBeta detail.",
        query: "alpha",
      })
    ).toBe("Alpha intro.\n\nBeta detail.");
  });

  it("uses paragraph boundaries when no sentence ends late enough", () => {
    expect(
      selectRelevantContent({
        content: `${"a".repeat(22)}\n\n${"b".repeat(20)}`,
        maxLength: 35,
      })
    ).toBe("a".repeat(22));
  });

  it("uses sentence boundaries before paragraph boundaries", () => {
    expect(
      selectRelevantContent({
        content: "aaaaaaaaaaaaaaaaaaaaaaaaa. Bbbbbbbbbbbbbbbbbbbbb",
        maxLength: 35,
      })
    ).toBe("aaaaaaaaaaaaaaaaaaaaaaaaa.");
  });

  it("keeps a sentence that ends exactly at the limit", () => {
    // The second sentence ends at character 40, which is the limit. The third does not fit.
    const content = `${"a".repeat(29)}. B${"b".repeat(7)}. C${"c".repeat(29)}.`;
    expect(selectRelevantContent({ content, maxLength: 40 })).toBe(
      `${"a".repeat(29)}. B${"b".repeat(7)}.`
    );
  });

  it("ends at a line break, which the platform counts as the end of a sentence", () => {
    expect(
      selectRelevantContent({
        content: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\nbbbbbbbbbbbbbbbbbbbb",
        maxLength: 40,
      })
    ).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  });

  it.each([
    {
      language: "English",
      content:
        "What is a differential equation? It links a function to its rate of change. Why does stability matter! It tells whether a small push dies out or grows.",
      maxLength: 110,
      expected:
        "What is a differential equation? It links a function to its rate of change. Why does stability matter!",
    },
    {
      language: "Japanese",
      content:
        "微分方程式は変化を表す式です。解が安定とは小さな乱れが消えることです。リャプノフ関数で安定性を確かめます。次に数値の例を見ていきます。",
      maxLength: 60,
      expected:
        "微分方程式は変化を表す式です。解が安定とは小さな乱れが消えることです。リャプノフ関数で安定性を確かめます。",
    },
  ])(
    "ends a cut at the end of a sentence ($language)",
    ({ content, expected, maxLength }) => {
      expect(selectRelevantContent({ content, maxLength })).toBe(expected);
    }
  );

  it("uses word boundaries before hard truncation", () => {
    expect(
      selectRelevantContent({
        content: "aaaaaaaaaa bbbbbbbbbb cccccccc dddddddddd",
        maxLength: 34,
      })
    ).toBe("aaaaaaaaaa bbbbbbbbbb cccccccc...");
  });

  it("hard truncates when no clean boundary exists", () => {
    expect(
      selectRelevantContent({
        content: "abcdefghijklmnopqrstuvwxyz",
        maxLength: 10,
      })
    ).toBe("abcdefghij...");
  });

  it("preserves structure around relevant middle paragraphs", () => {
    const selected = selectRelevantContent({
      content:
        "Intro paragraph.\n\nRational function domain detail.\n\nRational rational function example.\n\nConclusion paragraph.",
      query: "rational domain missing",
    });

    expect(selected).toBe(
      "Intro paragraph.\n\nRational function domain detail.\n\nRational rational function example.\n\nConclusion paragraph."
    );
  });

  it("selects relevant Unicode paragraphs without language-specific stop words", () => {
    const selected = selectRelevantContent({
      content:
        "導入です。\n\n微分方程式の安定性をリャプノフ関数で確認します。\n\nこれは別の話題で、長く続く無関係な説明です。モデルの検索選択では残すべきではありません。\n\n結論です。",
      maxLength: 60,
      query: "微分方程式 安定性",
    });

    expect(selected).toBe(
      "導入です。\n\n微分方程式の安定性をリャプノフ関数で確認します。\n\n結論です。"
    );
  });

  it.each(pages)(
    "keeps the paragraph that holds the task's words ($language)",
    (page) => {
      const { maxLength, relevant, task } = page;
      const options = {
        content: writePage(page),
        maxLength,
        preserveStructure: false,
        query: task,
      };

      expect(
        selectRelevantContent({ ...options, maxRelevantParagraphs: 1 })
      ).toBe(relevant);
      expect(selectRelevantContent(options).startsWith(relevant)).toBe(true);
    }
  );

  it("counts a word of any length, so a one-character word finds its paragraph", () => {
    expect(
      pickParagraph(
        [
          "この記事では、身近な動物について短く紹介します。",
          "犬は人と一緒に歩くのが好きな動物です。",
          "猫は小さな動物で、一日の多くを眠って過ごします。",
          "鳥は空を飛び、季節によって住む場所を変えます。",
        ],
        80,
        "猫"
      )
    ).toBe("猫は小さな動物で、一日の多くを眠って過ごします。");
  });

  it("matches whole words, so a word inside a longer word finds nothing", () => {
    expect(
      pickParagraph(
        [
          "Category theory studies the structure of mathematics.",
          "The cat sleeps on the sofa all afternoon.",
          "Dogs enjoy a long walk in the park every morning.",
        ],
        120,
        "cat"
      )
    ).toBe("The cat sleeps on the sofa all afternoon.");
  });

  it("counts a task word once for a paragraph, however often the paragraph repeats it", () => {
    const winner =
      "The domain of a rational expression excludes every zero of its denominator.";

    expect(
      pickParagraph(
        [
          "A function is a rule. A function takes an input. Each function gives one output.",
          winner,
          "Weather notes for the week and a list of the shops that stay open.",
          "Travel notes about trains and the weather in spring.",
        ],
        150,
        "domain rational function"
      )
    ).toBe(winner);
  });

  it("keeps the long paragraph that holds the most of the task's words over a short heading that holds fewer", () => {
    const relevant = Arr.join(
      [
        "A Lyapunov function shows the stability of an equilibrium without solving the equation.",
        "It behaves like an energy: it is zero at the rest point, positive everywhere else, and it never grows along a solution.",
        "When such a function exists, every solution that starts near the rest point stays near it.",
        "Finding one is the hard part, and textbooks usually start from a mechanical example, such as a pendulum with friction, before they move to the general theory.",
      ],
      " "
    );

    expect(
      pickParagraph(
        [
          "Welcome to the notes of the week.",
          "Lyapunov stability.",
          relevant,
          "Cooking notes and a list of the shops that stay open.",
          "Travel notes about trains and the weather in spring.",
        ],
        560,
        "stability Lyapunov function"
      )
    ).toBe(relevant);
  });

  it("does not look for the words of the task's section labels", () => {
    const relevant =
      "A Lyapunov function shows stability when it decreases along every solution.";

    expect(
      pickParagraph(
        [
          "This page explains how an HTTP server answers a call.",
          "Each request starts with a request line. The request headers follow, and then the request body ends the request.",
          relevant,
          "Weather notes for the week.",
          "Closing remarks.",
        ],
        150,
        "# Request\n\nHow does a Lyapunov function show stability?\n\n# Objective\n\nExplain the idea."
      )
    ).toBe(relevant);
  });

  it("creates one word segmenter for a page, however many paragraphs it holds", () => {
    const segmenter = vi.spyOn(Intl, "Segmenter");
    const page = pages[0];

    selectRelevantContent({
      content: writePage(page),
      maxLength: page.maxLength,
      preserveStructure: false,
      query: page.task,
    });

    expect(segmenter).toHaveBeenCalledTimes(1);
    segmenter.mockRestore();
  });

  it("keeps introduction, relevant middle content, and conclusion when selecting from long structured content", () => {
    const selected = selectRelevantContent({
      content:
        "Intro frame.\n\nRational domain detail.\n\nUnrelated filler text.\n\nClosing note.",
      maxLength: 70,
      query: "rational",
    });

    expect(selected).toBe(
      "Intro frame.\n\nRational domain detail.\n\nClosing note."
    );
  });

  it("sorts multiple relevant middle paragraphs back into reading order", () => {
    const selected = selectRelevantContent({
      content:
        "Intro frame.\n\nRational rational domain detail.\n\nLong unrelated filler paragraph that makes the source exceed the selected budget.\n\nRational detail.\n\nClosing note.",
      maxLength: 100,
      query: "rational",
    });

    expect(selected).toBe(
      "Intro frame.\n\nRational rational domain detail.\n\nRational detail.\n\nClosing note."
    );
  });

  it("falls back to truncation when long content has only two paragraphs", () => {
    expect(
      selectRelevantContent({
        content:
          "First paragraph with enough text to exceed the selected budget.\n\nSecond paragraph with more relevant rational detail.",
        maxLength: 60,
        query: "rational",
      })
    ).toBe("First paragraph with enough text to exceed the selected...");
  });

  it("skips structured paragraphs that do not fit", () => {
    const selected = selectRelevantContent({
      content:
        "Intro paragraph that already takes room.\n\nRational function detail that is too long to fit inside the target selection budget.\n\nConclusion paragraph that also does not fit.",
      maxLength: 60,
      query: "rational",
    });

    expect(selected).toBe("Intro paragraph that already takes room.");
  });

  it("selects relevant paragraphs without preserving structure", () => {
    const selected = selectRelevantContent({
      content:
        "Intro paragraph.\n\nRational function domain detail.\n\nAnother rational function example.\n\nConclusion paragraph.",
      maxLength: 100,
      preserveStructure: false,
      query: "rational",
    });

    expect(selected).toBe(
      "Rational function domain detail.\n\nAnother rational function example."
    );
  });

  it("falls back to scraped content when no paragraph matches", () => {
    expect(
      selectRelevantContent({
        content:
          "Alpha introduction.\n\nBeta explanation.\n\nGamma closing paragraph.",
        preserveStructure: false,
        query: "unmatched",
      })
    ).toBe(
      "Alpha introduction.\n\nBeta explanation.\n\nGamma closing paragraph."
    );
  });

  it("falls back when matching paragraphs cannot fit the target budget", () => {
    expect(
      selectRelevantContent({
        content:
          "Alpha introduction.\n\nRational function paragraph that is far too long for the selected budget.\n\nGamma closing paragraph.",
        maxLength: 20,
        preserveStructure: false,
        query: "rational",
      })
    ).toBe("Alpha introduction.");
  });
});

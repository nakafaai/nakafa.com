import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { candidate, createCaptureTest } from "@repo/backend/test/nina/memory";
import { Array as Arr } from "effect";

const pause = Ref.getFunctionReference(refs.public.nina.memory.pause);

const NOW = Date.UTC(2026, 9, 10, 12);
const LESSON = "lesson:material:lesson:mathematics:material-section:limits";
const PATH = "path:materials/mathematics";
const CHEMISTRY = "lesson:material:lesson:chemistry";
/** Nine words, and a text that has them all and one more: they say the same, in other words. */
const SCHOOL = "Saya kelas 12 IPA di SMA Negeri 1 Bandung";
const SCHOOL_NOW = `${SCHOOL} sekarang`;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("memory capture write", () => {
  it("writes a new memory as Nina's own, sealed, linked to the topics of the open page, and indexed", async () => {
    const f = await createCaptureTest();
    expect(await f.run([candidate()], { topics: [LESSON, PATH] })).toBe(1);
    const [row] = await f.stored();
    expect(row).toMatchObject({
      author: "nina",
      confirmedAt: NOW,
      kind: "level",
      topics: [LESSON, PATH],
      userId: f.identity.userId,
    });
    expect(row?.validUntil).toBeUndefined();
    // Only the learner gives a memory a title.
    expect(row).not.toHaveProperty("title");
    expect(new TextDecoder("latin1").decode(row?.text)).not.toContain("Kelas");
    expect(await f.texts()).toEqual(["Kelas 12 IPA."]);
    expect(await f.remembered()).toBe(1);
    expect(Arr.map(await f.keys(), (key) => key.key)).toEqual(
      expect.arrayContaining([
        `t:${LESSON}`,
        `t:${PATH}`,
        await f.wordKeyOf("kelas"),
        await f.wordKeyOf("12"),
        await f.wordKeyOf("ipa"),
      ])
    );
    expect(await f.find({ limit: 5, text: "ipa" })).toEqual(["Kelas 12 IPA."]);
  });

  it("gives a situation the end of its last day and drops one without a usable date", async () => {
    const f = await createCaptureTest();
    const situation = candidate({
      kind: "situation",
      quote: "ulangan kimia",
      text: "Ulangan kimia.",
    });
    expect(
      await f.run([
        situation,
        { ...situation, until: "20 Oktober" },
        { ...situation, until: "2026-10-20" },
      ])
    ).toBe(1);
    expect(await f.stored()).toEqual([
      expect.objectContaining({
        kind: "situation",
        validUntil: Date.UTC(2026, 9, 20, 23, 59, 59, 999),
      }),
    ]);
  });

  it("moves the end of a situation that the learner says again with a new day", async () => {
    const f = await createCaptureTest();
    const id = await f.seed({
      kind: "situation",
      text: "Ulangan kimia",
      validUntil: Date.UTC(2026, 9, 12, 23, 59, 59, 999),
    });
    expect(
      await f.run(
        [
          candidate({
            kind: "situation",
            known: id,
            text: "Ulangan kimia diundur",
            until: "2026-10-25",
          }),
        ],
        { seen: [{ confirmedAt: 1, id }] }
      )
    ).toBe(1);
    expect(await f.stored()).toEqual([
      expect.objectContaining({
        _id: id,
        validUntil: Date.UTC(2026, 9, 25, 23, 59, 59, 999),
      }),
    ]);
    expect(await f.texts()).toEqual(["Ulangan kimia diundur"]);
    // The new words are what the memory is found by.
    expect(await f.find({ limit: 5, text: "diundur" })).toEqual([
      "Ulangan kimia diundur",
    ]);
  });

  it("rewrites the words of a memory Nina wrote when the candidate names it and says something new, and moves its keys to the new words", async () => {
    const f = await createCaptureTest();
    const id = await f.seed({
      confirmedAt: 1,
      kind: "level",
      text: "Kelas 11.",
      topics: [CHEMISTRY],
    });
    expect(await f.run([candidate({ known: id })], { topics: [LESSON] })).toBe(
      1
    );
    expect(await f.stored()).toEqual([
      expect.objectContaining({
        _id: id,
        author: "nina",
        confirmedAt: NOW,
        kind: "level",
        topics: [CHEMISTRY, LESSON],
      }),
    ]);
    expect(await f.texts()).toEqual(["Kelas 12 IPA."]);
    expect(await f.remembered()).toBe(1);
    // The words that went find nothing, and the words that came find the memory.
    expect(await f.find({ limit: 5, text: "11" })).toEqual([]);
    expect(await f.find({ limit: 5, text: "ipa" })).toEqual(["Kelas 12 IPA."]);
  });

  it("rewrites the words of a memory Nina wrote when the candidate says nearly the same, because Nina wrote them", async () => {
    const f = await createCaptureTest();
    await f.seed({ kind: "level", text: SCHOOL });
    expect(await f.run([candidate({ text: SCHOOL_NOW })])).toBe(1);
    expect(await f.stored()).toEqual([
      expect.objectContaining({ author: "nina", confirmedAt: NOW }),
    ]);
    expect(await f.texts()).toEqual([SCHOOL_NOW]);
  });

  it("keeps Nina's wording of a memory when the candidate only restates it in another case, punctuation or spacing", async () => {
    const f = await createCaptureTest();
    const id = await f.seed({
      confirmedAt: 1,
      kind: "level",
      text: "Kelas 12 IPA.",
    });
    expect(await f.run([candidate({ text: "kelas   12,  ipa" })])).toBe(1);
    // The memory is confirmed now, and its words are the ones Nina wrote first.
    expect(await f.stored()).toEqual([
      expect.objectContaining({
        _id: id,
        author: "nina",
        confirmedAt: NOW,
        kind: "level",
      }),
    ]);
    expect(await f.texts()).toEqual(["Kelas 12 IPA."]);
  });

  it("never replaces the words of a memory the learner wrote when the candidate names it but says something else: the candidate becomes a memory of Nina's", async () => {
    const f = await createCaptureTest();
    const id = await f.seed({
      author: "learner",
      confirmedAt: 1,
      text: "Kelas 11.",
      title: "Sekolah",
      topics: [CHEMISTRY],
    });
    const [before] = await f.stored();
    expect(await f.run([candidate({ known: id })], { topics: [LESSON] })).toBe(
      1
    );
    const [learners, ninas, ...others] = await f.stored();
    expect(others).toEqual([]);
    // The learner's row is the same bytes: `toStrictEqual` compares the sealed
    // text and title, where `toEqual` takes any two buffers for equal.
    expect(learners).toStrictEqual(before);
    expect(ninas).toMatchObject({
      author: "nina",
      confirmedAt: NOW,
      kind: "level",
      topics: [LESSON],
    });
    expect(ninas).not.toHaveProperty("title");
    expect(await f.texts()).toEqual(["Kelas 11.", "Kelas 12 IPA."]);
    expect(await f.titles()).toEqual(["Sekolah", null]);
    expect(await f.remembered()).toBe(1);
  });

  it("confirms the memory of Nina's that says the same, and adds no copy of it, when the candidate names a memory the learner wrote that says something else", async () => {
    const f = await createCaptureTest();
    const id = await f.seed({
      author: "learner",
      confirmedAt: 1,
      text: "Kelas 11.",
    });
    const ninas = await f.seed({
      confirmedAt: 1,
      kind: "level",
      text: "Kelas 12 IPA.",
    });
    const [before] = await f.stored();
    expect(await f.run([candidate({ known: id })])).toBe(1);
    const [learners, confirmed, ...others] = await f.stored();
    expect(others).toEqual([]);
    // `toStrictEqual` compares the sealed bytes; `toEqual` takes any two buffers for equal.
    expect(learners).toStrictEqual(before);
    expect(confirmed).toMatchObject({
      _id: ninas,
      author: "nina",
      confirmedAt: NOW,
      kind: "level",
    });
    expect(await f.texts()).toEqual(["Kelas 11.", "Kelas 12 IPA."]);
    expect(await f.remembered()).toBe(1);
  });

  it("leaves a memory that is only a title as it is, though a candidate that says nothing either seems to repeat its empty words", async () => {
    const f = await createCaptureTest();
    await f.seed({ author: "learner", text: "", title: "Ujian UTBK" });
    const [before] = await f.stored();
    await f.run([
      candidate({ kind: "situation", text: "?", until: "2026-10-20" }),
    ]);
    const [learners] = await f.stored();
    // The memory is a title alone, so it gets no kind and no end day to expire by.
    expect(learners).toStrictEqual(before);
  });

  it.each([
    ["names it", true],
    ["says words like it", false],
  ])(
    "confirms a memory the learner wrote when a candidate that %s says the same, and leaves its words and its author",
    async (_, named) => {
      const f = await createCaptureTest();
      const id = await f.seed({
        author: "learner",
        confirmedAt: 1,
        text: SCHOOL,
        title: "Sekolah",
      });
      const [before] = await f.stored();
      expect(
        await f.run([
          candidate({ ...(named ? { known: id } : {}), text: SCHOOL_NOW }),
        ])
      ).toBe(1);
      const [after, ...others] = await f.stored();
      expect(others).toEqual([]);
      expect(after).toMatchObject({
        _id: id,
        author: "learner",
        confirmedAt: NOW,
        kind: "level",
      });
      // `toEqual` takes any two sealed buffers for equal; `toStrictEqual` compares their bytes.
      expect(after?.text).toStrictEqual(before?.text);
      expect(after?.title).toStrictEqual(before?.title);
      expect(await f.texts()).toEqual([SCHOOL]);
      expect(await f.titles()).toEqual(["Sekolah"]);
    }
  );

  it("gives a memory the learner wrote the kind of the candidate that names it, or that says the same", async () => {
    const f = await createCaptureTest();
    const named = await f.seed({ author: "learner", text: "Kelas 12 IPA" });
    await f.seed({ author: "learner", text: "Mau ikut SNBT 2027" });
    expect(
      await f.run([
        candidate({ known: named }),
        candidate({
          kind: "goal",
          quote: "mau ikut snbt 2027",
          text: "mau ikut SNBT 2027!",
        }),
      ])
    ).toBe(2);
    // The words of both stay the learner's, and each memory takes a kind.
    expect(await f.stored()).toEqual([
      expect.objectContaining({
        author: "learner",
        confirmedAt: NOW,
        kind: "level",
      }),
      expect.objectContaining({
        author: "learner",
        confirmedAt: NOW,
        kind: "goal",
      }),
    ]);
    expect(await f.texts()).toEqual(["Kelas 12 IPA", "Mau ikut SNBT 2027"]);
  });

  it("dates a memory the learner wrote when a chat says it is a situation", async () => {
    const f = await createCaptureTest();
    const id = await f.seed({ author: "learner", text: "Ulangan kimia" });
    expect(
      await f.run([
        candidate({
          kind: "situation",
          known: id,
          text: "Ulangan kimia.",
          until: "2026-10-25",
        }),
      ])
    ).toBe(1);
    expect(await f.stored()).toEqual([
      expect.objectContaining({
        author: "learner",
        kind: "situation",
        validUntil: Date.UTC(2026, 9, 25, 23, 59, 59, 999),
      }),
    ]);
  });

  it("writes a new memory when the memory it names or repeats is of another kind, or the known memory is another learner's", async () => {
    const f = await createCaptureTest();
    const other = await f.stranger();
    const goal = await f.seed({ kind: "goal", text: "Ikut SNBT" });
    const theirs = await f.seed({
      kind: "level",
      text: "Kelas 9",
      userId: other.userId,
    });
    expect(await f.run([candidate({ known: goal })])).toBe(1);
    expect(await f.run([candidate({ text: "Ikut SNBT" })])).toBe(1);
    expect(
      await f.run([candidate({ known: theirs, text: "Kelas 12 SMA." })])
    ).toBe(1);
    expect(await f.texts()).toEqual([
      "Ikut SNBT",
      "Kelas 12 IPA.",
      "Ikut SNBT",
      "Kelas 12 SMA.",
    ]);
    expect(await f.stored()).toContainEqual(
      expect.objectContaining({ _id: goal, confirmedAt: 1, kind: "goal" })
    );
    expect(await f.texts(other.userId)).toEqual(["Kelas 9"]);
  });

  it("folds candidates of one call that say the same into one memory", async () => {
    const f = await createCaptureTest();
    expect(
      await f.run([candidate(), candidate({ text: "kelas 12 ipa" })])
    ).toBe(1);
    expect(await f.stored()).toHaveLength(1);
    expect(await f.remembered()).toBe(1);
    // No page with a topic was open, so the memory has no topic and no topic key.
    expect(await f.stored()).toEqual([
      expect.not.objectContaining({ topics: expect.anything() }),
    ]);
    expect(await f.keys()).toHaveLength(3);
  });

  it("lets the first candidate of a call settle a memory: a later candidate of the call only confirms it", async () => {
    const f = await createCaptureTest();
    const situation = candidate({
      kind: "situation",
      quote: "ulangan kimia",
      text: "Ulangan kimia.",
    });
    expect(
      await f.run([
        { ...situation, until: "2026-10-20" },
        { ...situation, until: "2026-10-25" },
      ])
    ).toBe(1);
    expect(await f.stored()).toEqual([
      expect.objectContaining({
        validUntil: Date.UTC(2026, 9, 20, 23, 59, 59, 999),
      }),
    ]);
  });

  it("counts every memory it writes or confirms", async () => {
    const f = await createCaptureTest();
    expect(
      await f.run([
        candidate(),
        candidate({
          kind: "style",
          quote: "contoh soal",
          text: "Suka contoh soal.",
        }),
      ])
    ).toBe(2);
    expect(await f.remembered()).toBe(2);
  });
});

describe("memory capture write topics", () => {
  it("links a confirmed memory to the topics of the open page that it lacks, eight at most, and moves no key it does not need", async () => {
    const f = await createCaptureTest();
    const id = await f.seed({
      kind: "level",
      text: "Kelas 12 IPA.",
      topics: [PATH],
    });
    expect(await f.run([candidate()], { topics: [LESSON, PATH] })).toBe(1);
    expect(await f.stored()).toEqual([
      expect.objectContaining({ _id: id, topics: [PATH, LESSON] }),
    ]);
    expect(Arr.map(await f.keys(), (key) => key.key)).toEqual(
      expect.arrayContaining([`t:${LESSON}`, `t:${PATH}`])
    );
    // Said again on the same page, the memory gains nothing and its keys stay.
    const keys = await f.keys();
    expect(await f.run([candidate()], { topics: [LESSON, PATH] })).toBe(1);
    expect(await f.keys()).toStrictEqual(keys);
    // Said on other pages, it gains six topics and stops at eight.
    const topic = (index: number) => `path:materials/subject${index}`;
    await f.run([candidate()], { topics: Arr.makeBy(8, topic) });
    const [row] = await f.stored();
    expect(row?.topics).toEqual([PATH, LESSON, ...Arr.makeBy(6, topic)]);
    expect(Arr.map(await f.keys(), (key) => key.key)).not.toContain(
      `t:${topic(6)}`
    );
  });
});

describe("memory capture write without a limit", () => {
  it("keeps every memory and writes the new one, however many the learner has", async () => {
    const f = await createCaptureTest();
    await f.fill(120);
    expect(await f.run([candidate()])).toBe(1);
    const texts = await f.texts();
    expect(texts).toHaveLength(121);
    expect(texts).toContain("Memory 0");
    expect(texts).toContain("Kelas 12 IPA.");
    expect(await f.remembered()).toBe(1);
  });

  it("finds the memory that says the same among 300, confirms it, and adds no copy", async () => {
    const f = await createCaptureTest();
    await f.fill(299, { author: "learner" });
    // The call read the first twelve memories, and not this one.
    const id = await f.seed({ kind: "level", text: "Kelas 12 IPA." });
    expect(await f.run([candidate()])).toBe(1);
    expect(await f.stored()).toHaveLength(300);
    expect(await f.stored()).toContainEqual(
      expect.objectContaining({ _id: id, confirmedAt: NOW })
    );
  });
});

describe("memory capture write that changes nothing", () => {
  it("writes nothing while memory is paused", async () => {
    const f = await createCaptureTest();
    await f.owner.mutation(pause, { paused: true });
    expect(await f.run([candidate()])).toBe(0);
    expect(await f.stored()).toEqual([]);
    expect(await f.remembered()).toBeUndefined();
  });

  it("writes nothing for a turn deleted meanwhile", async () => {
    const f = await createCaptureTest();
    await f.t.mutation((ctx) => ctx.db.delete("ninaTurns", f.turnId));
    expect(await f.run([candidate()])).toBe(0);
    expect(await f.stored()).toEqual([]);
  });

  it("writes whether or not the chat of the turn still exists, because it reads no chat", async () => {
    const f = await createCaptureTest();
    expect(await f.run([candidate()])).toBe(1);
    await f.t.mutation((ctx) => ctx.db.delete("chats", f.chatId));
    expect(
      await f.run([
        candidate({
          kind: "style",
          quote: "contoh soal",
          text: "Suka contoh soal.",
        }),
      ])
    ).toBe(1);
    expect(await f.texts()).toEqual(["Kelas 12 IPA.", "Suka contoh soal."]);
  });

  it("writes nothing for no candidates", async () => {
    const f = await createCaptureTest();
    expect(await f.run([])).toBe(0);
    expect(await f.stored()).toEqual([]);
    expect(await f.remembered()).toBeUndefined();
  });
});

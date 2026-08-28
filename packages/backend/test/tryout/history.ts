/** Fixed immutable old placement vector from Aksara's history contract tests. */
export const TEST_STORED_TRYOUT_PLACEMENT = {
  family: "tryout",
  record: {
    row: {
      answerArtifactHash:
        "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      answerContentKey:
        "question-bank/tryout/indonesia/snbt/general-reasoning/set-1/question-1/answer",
      choices: [
        { isCorrect: true, label: "A", optionKey: "option-1", order: 1 },
        { isCorrect: false, label: "B", optionKey: "option-2", order: 2 },
      ],
      contentHash: "e".repeat(64),
      countryKey: "indonesia",
      examKey: "snbt",
      locale: "en",
      questionArtifactHash:
        "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      questionContentKey:
        "question-bank/tryout/indonesia/snbt/general-reasoning/set-1/question-1/question",
      questionOrder: 1,
      questionSourcePath:
        "packages/corpus/question-bank/tryout/indonesia/snbt/general-reasoning/set-1/question-1",
      rendererDomain: "snbt-general",
      scope: "server",
      sectionKey: "general-reasoning",
      setKey: "set-1",
      sourceRevision: "retained-source",
      title: "Question 1",
      trackKey: "2027",
    },
    rowHash:
      "sha256:ce4c00fece190e53c6189b2ec7c0c3b2956083f2a06573137e65b57fdce69e58",
  },
  rowKind: "placement",
} as const;

/** Synthetic content-addressed snapshot used only for retained read tests. */
export const TEST_STORED_TRYOUT_SNAPSHOT_ID =
  `sha256:${"a".repeat(64)}` as const;

export const TEST_STORED_TRYOUT_RELEASE_ID = "retained-release";

export const GET_QURAN_REFERENCE_OUTPUT = {
  alignmentId: "alignment:quran:quran-surah:1",
  assetId: "asset:en:quran:quran-surah:1",
  conceptId: "concept:quran:surah:1",
  content_id: "asset:en:quran:quran-surah:1",
  learningObjectId: "lo:quran-surah:1",
  lensId: "lens:quran",
  locale: "en",
  route: "quran/1",
  section: "quran",
  url: "https://nakafa.com/en/quran/1",
  markdown_url: "https://nakafa.com/en/quran/1.md",
  name: "Technical Surah 1",
  pre_bismillah: null,
  revelation: "Meccan",
  verses: [
    {
      arabic: "آية 1",
      number: 1,
      translation: {
        notes: [],
        segments: [
          { kind: "text", offset: 0, value: "Technical translation 1" },
        ],
      },
    },
    {
      arabic: "آية 2",
      number: 2,
      translation: {
        notes: [],
        segments: [
          { kind: "text", offset: 0, value: "Technical translation 2" },
        ],
      },
    },
  ],
  meaning: { locale: "en", text: "Technical meaning 1" },
  sources: {
    arabic: {
      artifact: {
        byte_count: 1,
        digest:
          "sha256:1111111111111111111111111111111111111111111111111111111111111111",
        file_count: 1,
      },
      id: "tanzil-text",
      kind: "embedded",
      label: "Technical source tanzil-text en",
      notice: "Technical attribution notice en",
      publisher: "Nakafa protocol tests",
      retrieved_at: "2026-07-31T00:00:00Z",
      source_url: "https://example.test/tanzil-text",
      terms: {
        artifact: {
          byte_count: 1,
          digest:
            "sha256:1111111111111111111111111111111111111111111111111111111111111111",
          file_count: 1,
        },
        url: "https://example.test/tanzil-text/terms",
      },
      update_url: "https://example.test/tanzil-text/updates",
      version: "technical-version",
    },
    translation: {
      artifact: {
        byte_count: 1,
        digest:
          "sha256:1111111111111111111111111111111111111111111111111111111111111111",
        file_count: 1,
      },
      id: "quranenc-english",
      kind: "embedded",
      label: "Technical source quranenc-english en",
      notice: "Technical attribution notice en",
      publisher: "Nakafa protocol tests",
      retrieved_at: "2026-07-31T00:00:00Z",
      source_url: "https://example.test/quranenc-english",
      terms: {
        artifact: {
          byte_count: 1,
          digest:
            "sha256:1111111111111111111111111111111111111111111111111111111111111111",
          file_count: 1,
        },
        url: "https://example.test/quranenc-english/terms",
      },
      update_url: "https://example.test/quranenc-english/updates",
      version: "technical-version",
      locale: "en",
    },
  },
  tafsir_access: {
    kind: "external",
    locale: "en",
    notice: "Technical English Tafsir notice.",
    source: {
      id: "mokhtasar-english",
      kind: "external",
      label: "Technical source mokhtasar-english en",
      notice: "Technical attribution notice en",
      publisher: "Nakafa protocol tests",
      retrieved_at: "2026-07-31T00:00:00Z",
      source_url: "https://example.test/mokhtasar-english",
      terms: {
        access: "link-only",
        url: "https://example.test/mokhtasar-english/terms",
      },
      update_url: "https://example.test/mokhtasar-english/updates",
      version: "technical-version",
    },
  },
};

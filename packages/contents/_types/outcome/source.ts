import {
  LearningOutcomeSchema,
  OutcomeConceptAlignmentSchema,
  ProgramOutlineNodeSchema,
} from "@repo/contents/_types/outcome/schema";
import { Schema } from "effect";

const OutcomeSourceSchema = Schema.Struct({
  conceptAlignments: Schema.Array(OutcomeConceptAlignmentSchema),
  outcomes: Schema.Array(LearningOutcomeSchema),
  outlineNodes: Schema.Array(ProgramOutlineNodeSchema),
});

/**
 * Typed source Module for program outlines, official outcomes, and concept alignments.
 *
 * Curriculum imports generate or review TS source modules that satisfy this
 * Interface; JSON source registries are intentionally blocked.
 */
export const OUTCOME_SOURCE = Schema.decodeUnknownSync(OutcomeSourceSchema)({
  outlineNodes: [
    {
      displayOrder: 10,
      key: "nakafa.basics",
      level: "track",
      programKey: "nakafa-stem-path",
      translations: {
        en: {
          description: "Start with the core ideas.",
          title: "Basics",
        },
        id: {
          description: "Mulai dari ide inti.",
          title: "Dasar",
        },
      },
    },
    {
      displayOrder: 20,
      key: "id.km.class-10",
      level: "class",
      programKey: "id-kurikulum-merdeka",
      translations: {
        en: {
          description: "Grade 10 learning path.",
          title: "Class 10",
        },
        id: {
          description: "Jalur belajar kelas 10.",
          title: "Kelas 10",
        },
      },
    },
    {
      displayOrder: 21,
      key: "id.km.class-10.mathematics",
      level: "subject",
      parentKey: "id.km.class-10",
      programKey: "id-kurikulum-merdeka",
      translations: {
        en: {
          description: "Mathematics outcomes.",
          title: "Mathematics",
        },
        id: {
          description: "Capaian matematika.",
          title: "Matematika",
        },
      },
    },
    {
      displayOrder: 22,
      key: "id.km.class-10.mathematics.statistics",
      level: "topic",
      parentKey: "id.km.class-10.mathematics",
      programKey: "id-kurikulum-merdeka",
      translations: {
        en: {
          description: "Statistics outcomes.",
          title: "Statistics",
        },
        id: {
          description: "Capaian statistika.",
          title: "Statistika",
        },
      },
    },
    {
      displayOrder: 30,
      key: "snbt.2026.quantitative",
      level: "section",
      programKey: "snbt-2026",
      translations: {
        en: {
          description: "Quantitative reasoning practice.",
          title: "Quantitative reasoning",
        },
        id: {
          description: "Latihan penalaran kuantitatif.",
          title: "Penalaran kuantitatif",
        },
      },
    },
    {
      displayOrder: 40,
      key: "tka.2026.mathematics",
      level: "section",
      programKey: "tka-2026",
      translations: {
        en: {
          description: "Mathematics readiness.",
          title: "Mathematics",
        },
        id: {
          description: "Kesiapan matematika.",
          title: "Matematika",
        },
      },
    },
  ],
  outcomes: [
    {
      code: "NAKAFA-BASICS-2026",
      key: "nakafa.basics.math-science",
      outlineKey: "nakafa.basics",
      programKey: "nakafa-stem-path",
      source: {
        label: "Nakafa Learning Graph",
        retrievedAt: "2026-06-14",
        type: "nakafa-editorial",
        url: "https://nakafa.com",
      },
      status: "active",
      translations: {
        en: {
          description: "Build core math and science foundations.",
          title: "Math and science foundations",
        },
        id: {
          description: "Bangun dasar matematika dan sains.",
          title: "Fondasi matematika dan sains",
        },
      },
      versionLabel: "2026",
    },
    {
      code: "KM-FE-MATH-STATISTICS",
      key: "id.km.fase-e.math.statistics",
      outlineKey: "id.km.class-10.mathematics.statistics",
      programKey: "id-kurikulum-merdeka",
      source: {
        label: "Capaian Pembelajaran dan ATP",
        retrievedAt: "2026-06-14",
        reviewAfter: "2027-01-01",
        type: "official-policy",
        url: "https://guru.kemendikdasmen.go.id/kurikulum/referensi-penerapan/capaian-pembelajaran/",
      },
      status: "active",
      translations: {
        en: {
          description: "Use statistics to summarize and interpret data.",
          title: "Statistics and data",
        },
        id: {
          description: "Gunakan statistika untuk merangkum dan membaca data.",
          title: "Statistika dan data",
        },
      },
      versionLabel: "Merdeka",
    },
    {
      code: "SNBT-2026-PK",
      key: "snbt.2026.quantitative-knowledge",
      outlineKey: "snbt.2026.quantitative",
      programKey: "snbt-2026",
      source: {
        label: "Informasi Umum UTBK-SNBT 2026",
        retrievedAt: "2026-06-14",
        reviewAfter: "2026-12-31",
        type: "official-blueprint",
        url: "https://snpmb.id/utbk-snbt/informasi-umum",
      },
      status: "active",
      translations: {
        en: {
          description:
            "Use quantitative reasoning for admission-test problems.",
          title: "Quantitative knowledge",
        },
        id: {
          description: "Gunakan penalaran kuantitatif untuk soal seleksi.",
          title: "Pengetahuan kuantitatif",
        },
      },
      versionLabel: "2026",
    },
    {
      code: "TKA-2026-MATH",
      key: "tka.2026.mathematics-readiness",
      outlineKey: "tka.2026.mathematics",
      programKey: "tka-2026",
      source: {
        label: "Portal TKA",
        retrievedAt: "2026-06-14",
        reviewAfter: "2026-12-31",
        type: "official-portal",
        url: "https://tka.kemendikdasmen.go.id/",
      },
      status: "planned",
      translations: {
        en: {
          description: "Prepare for mathematics readiness assessment tasks.",
          title: "Mathematics readiness",
        },
        id: {
          description: "Siapkan tugas asesmen kesiapan matematika.",
          title: "Kesiapan matematika",
        },
      },
      versionLabel: "2026",
    },
  ],
  conceptAlignments: [
    {
      conceptKey: "math.algebra.linear-equation",
      evidence: "Nakafa foundation path starts from core algebra fluency.",
      outcomeKey: "nakafa.basics.math-science",
      relation: "covers",
      reviewedAt: "2026-06-15",
    },
    {
      conceptKey: "science.foundation",
      evidence: "Nakafa foundation path includes core science models.",
      outcomeKey: "nakafa.basics.math-science",
      relation: "covers",
      reviewedAt: "2026-06-15",
    },
    {
      conceptKey: "math.statistics.mean",
      evidence:
        "Statistics outcome requires summarizing and interpreting data.",
      outcomeKey: "id.km.fase-e.math.statistics",
      relation: "covers",
      reviewedAt: "2026-06-15",
    },
    {
      conceptKey: "reasoning.quantitative",
      evidence: "SNBT quantitative knowledge is a reasoning domain.",
      outcomeKey: "snbt.2026.quantitative-knowledge",
      relation: "covers",
      reviewedAt: "2026-06-15",
    },
    {
      conceptKey: "math.algebra.linear-equation",
      evidence: "TKA mathematics readiness uses algebraic fluency.",
      outcomeKey: "tka.2026.mathematics-readiness",
      relation: "supports",
      reviewedAt: "2026-06-15",
    },
  ],
});

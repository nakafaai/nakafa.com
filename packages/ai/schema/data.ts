import { NakafaAgentExerciseOptionsSchema } from "@repo/contents/_lib/agent/schema/exercise";
import { NakafaAgentQuranReferenceOptionsSchema } from "@repo/contents/_lib/agent/schema/quran";
import { NakafaAgentReadOptionsSchema } from "@repo/contents/_lib/agent/schema/read";
import {
  NakafaAgentContentRefSchema,
  NakafaAgentSectionSchema,
} from "@repo/contents/_lib/agent/schema/ref";
import {
  NakafaAgentSearchOptionsSchema,
  NakafaAgentSearchResultSchema,
} from "@repo/contents/_lib/agent/schema/search";
import { NakafaAgentTaxonomyOptionsSchema } from "@repo/contents/_lib/agent/schema/taxonomy";
import { LocaleSchema } from "@repo/contents/_types/content";
import * as z from "zod";

const nakafaContentPreviewSchema = NakafaAgentContentRefSchema.extend({
  description: z.string(),
  title: z.string(),
});

const nakafaExercisePreviewSchema = NakafaAgentContentRefSchema.extend({
  count: z.number().int().min(1),
  exercise_number: z.number().int().min(1).nullable(),
  numbers: z.array(z.number().int().min(1)).min(1),
  title: z.string(),
});

const nakafaQuranPreviewSchema = NakafaAgentContentRefSchema.extend({
  from_verse: z.number().int().min(1),
  name: z.string(),
  revelation: z.string(),
  to_verse: z.number().int().min(1),
  translation: z.string(),
  verse_count: z.number().int().min(1),
});

const nakafaTaxonomyPreviewSchema = z.object({
  content_counts: z.array(
    z.object({
      count: z.number().int().min(0),
      locale: LocaleSchema,
    })
  ),
  locale: LocaleSchema,
  sections: z.array(NakafaAgentSectionSchema),
  tools: z.array(z.string()),
});

const nakafaSearchLoadingSchema = z.object({
  kind: z.literal("search"),
  status: z.literal("loading"),
  input: NakafaAgentSearchOptionsSchema,
});
const nakafaSearchDoneSchema = nakafaSearchLoadingSchema.extend({
  status: z.literal("done"),
  result: NakafaAgentSearchResultSchema,
});
const nakafaSearchErrorSchema = nakafaSearchLoadingSchema.extend({
  status: z.literal("error"),
  error: z.string(),
});

const nakafaContentLoadingSchema = z.object({
  kind: z.literal("content"),
  status: z.literal("loading"),
  input: NakafaAgentReadOptionsSchema,
});
const nakafaContentDoneSchema = nakafaContentLoadingSchema.extend({
  status: z.literal("done"),
  result: nakafaContentPreviewSchema,
});
const nakafaContentErrorSchema = nakafaContentLoadingSchema.extend({
  status: z.literal("error"),
  error: z.string(),
});

const nakafaExerciseLoadingSchema = z.object({
  kind: z.literal("exercise"),
  status: z.literal("loading"),
  input: NakafaAgentExerciseOptionsSchema,
});
const nakafaExerciseDoneSchema = nakafaExerciseLoadingSchema.extend({
  status: z.literal("done"),
  result: nakafaExercisePreviewSchema,
});
const nakafaExerciseErrorSchema = nakafaExerciseLoadingSchema.extend({
  status: z.literal("error"),
  error: z.string(),
});

const nakafaQuranLoadingSchema = z.object({
  kind: z.literal("quran"),
  status: z.literal("loading"),
  input: NakafaAgentQuranReferenceOptionsSchema,
});
const nakafaQuranDoneSchema = nakafaQuranLoadingSchema.extend({
  status: z.literal("done"),
  result: nakafaQuranPreviewSchema,
});
const nakafaQuranErrorSchema = nakafaQuranLoadingSchema.extend({
  status: z.literal("error"),
  error: z.string(),
});

const nakafaTaxonomyLoadingSchema = z.object({
  kind: z.literal("taxonomy"),
  status: z.literal("loading"),
  input: NakafaAgentTaxonomyOptionsSchema,
});
const nakafaTaxonomyDoneSchema = nakafaTaxonomyLoadingSchema.extend({
  status: z.literal("done"),
  result: nakafaTaxonomyPreviewSchema,
});
const nakafaTaxonomyErrorSchema = nakafaTaxonomyLoadingSchema.extend({
  status: z.literal("error"),
  error: z.string(),
});

export const nakafaDataSchema = z.union([
  nakafaSearchLoadingSchema,
  nakafaSearchDoneSchema,
  nakafaSearchErrorSchema,
  nakafaContentLoadingSchema,
  nakafaContentDoneSchema,
  nakafaContentErrorSchema,
  nakafaExerciseLoadingSchema,
  nakafaExerciseDoneSchema,
  nakafaExerciseErrorSchema,
  nakafaQuranLoadingSchema,
  nakafaQuranDoneSchema,
  nakafaQuranErrorSchema,
  nakafaTaxonomyLoadingSchema,
  nakafaTaxonomyDoneSchema,
  nakafaTaxonomyErrorSchema,
]);

/**
 * Schema for UI data parts written by Nina agents.
 */
export const dataPartSchema = z.object({
  suggestions: z.object({
    data: z.array(z.string()),
  }),
  nakafa: nakafaDataSchema,
  calculator: z.object({
    original: z.object({
      expression: z.string(),
      latex: z.string(),
    }),
    result: z.object({
      expression: z.string(),
      latex: z.string(),
      value: z.string(),
    }),
    status: z.enum(["done", "error"]),
    error: z.string().optional(),
  }),
  "scrape-url": z.object({
    url: z.string(),
    content: z.string(),
    status: z.enum(["loading", "done", "error"]),
    error: z.string().optional(),
  }),
  "web-search": z.object({
    query: z.string(),
    sources: z.array(
      z.object({
        title: z.string(),
        description: z.string(),
        url: z.string(),
        content: z.string(),
        citation: z.string(),
      })
    ),
    status: z.enum(["loading", "done", "error"]),
    error: z.string().optional(),
  }),
});

export type DataPart = z.infer<typeof dataPartSchema>;
export type NakafaDataPart = z.infer<typeof nakafaDataSchema>;

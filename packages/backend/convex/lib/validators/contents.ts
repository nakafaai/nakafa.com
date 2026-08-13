import { NAKAFA_AGENT_SECTIONS } from "@repo/contents/_lib/agent/constants";
import {
  ARTICLE_CATEGORIES,
  GRADES,
  PRESENTED_MATERIAL_DOMAINS,
  SUBJECT_CATEGORIES,
} from "@repo/contents/_types/taxonomy";
import { locales } from "@repo/utilities/locales";
import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";

/** Supported content languages for Convex validators. */
export const SUPPORTED_CONTENT_LOCALES = locales;
export const localeValidator = literals(...SUPPORTED_CONTENT_LOCALES);
export type Locale = Infer<typeof localeValidator>;

/** Public Nakafa content sections exposed to agents and search. */
export const nakafaSectionValidator = literals(...NAKAFA_AGENT_SECTIONS);
export type NakafaSection = Infer<typeof nakafaSectionValidator>;

/** Content families used by runtime tables and analytics events. */
export const CONTENT_TYPE_VALUES = ["article", "material", "question"] as const;
export const contentTypeValidator = literals(...CONTENT_TYPE_VALUES);
export type ContentType = Infer<typeof contentTypeValidator>;

export const articleCategoryValidator = literals(...ARTICLE_CATEGORIES);
export type ArticleCategory = Infer<typeof articleCategoryValidator>;

export const subjectCategoryValidator = literals(...SUBJECT_CATEGORIES);
export type SubjectCategory = Infer<typeof subjectCategoryValidator>;

export const gradeValidator = literals(...GRADES);
export type Grade = Infer<typeof gradeValidator>;

/** Material domains authenticated by Aksara before analytics storage. */
export const materialDomainValidator = v.string();

/** Exact retired material union retained only for deployed legacy schemas. */
export const materialValidator = literals(...PRESENTED_MATERIAL_DOMAINS);

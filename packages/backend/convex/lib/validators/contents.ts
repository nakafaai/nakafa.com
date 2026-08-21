import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { NAKAFA_AGENT_SECTIONS } from "@repo/contents/_lib/agent/constants";
import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";

/** Supported content languages for Convex validators. */
export const SUPPORTED_CONTENT_LOCALES = ACTIVE_APP_LOCALE_CODES;
export const localeValidator = literals(...SUPPORTED_CONTENT_LOCALES);
export type Locale = Infer<typeof localeValidator>;

/** Public Nakafa content sections exposed to agents and search. */
export const nakafaSectionValidator = literals(...NAKAFA_AGENT_SECTIONS);
export type NakafaSection = Infer<typeof nakafaSectionValidator>;

/** Content families used by runtime tables and analytics events. */
export const CONTENT_TYPE_VALUES = ["article", "material", "question"] as const;
export const contentTypeValidator = literals(...CONTENT_TYPE_VALUES);
export type ContentType = Infer<typeof contentTypeValidator>;

/** Material domains authenticated by Aksara before analytics storage. */
export const materialDomainValidator = v.string();

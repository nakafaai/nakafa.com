import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { NAKAFA_AGENT_SECTIONS } from "@repo/contents/agent/constants";
import { Schema } from "effect";
/** Supported content languages for Convex validators. */
export const SUPPORTED_CONTENT_LOCALES = ACTIVE_APP_LOCALE_CODES;
export const localeValidator = Schema.Literals([...SUPPORTED_CONTENT_LOCALES]);
export type Locale = typeof localeValidator.Type;

/** Public Nakafa content sections exposed to agents and search. */
export const nakafaSectionValidator = Schema.Literals([
  ...NAKAFA_AGENT_SECTIONS,
]);
export type NakafaSection = typeof nakafaSectionValidator.Type;

/** Content families used by runtime tables and analytics events. */
export const CONTENT_TYPE_VALUES = ["article", "material", "question"] as const;
export const contentTypeValidator = Schema.Literals([...CONTENT_TYPE_VALUES]);

/** Material domains authenticated by Aksara before analytics storage. */
export const materialDomainValidator = Schema.String;

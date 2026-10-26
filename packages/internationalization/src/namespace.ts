import { Record as Rec, Schema } from "effect";

/**
 * Every namespace of the app dictionaries, and the standalone pages' namespaces
 * beside them. This module names them without reading a dictionary, so a client
 * module that decodes a namespace never loads the messages. The server module
 * `namespaces.ts` checks this record against the English dictionary.
 */
const messageNamespaceFlags = {
  AnalyticsConsent: true,
  Articles: true,
  Auth: true,
  Classroom: true,
  Common: true,
  ComingSoon: true,
  Comments: true,
  Contributor: true,
  DataTable: true,
  Editor: true,
  Exams: true,
  Faq: true,
  Holy: true,
  Home: true,
  Landing: true,
  LearningPrograms: true,
  Legal: true,
  Marketing: true,
  Memory: true,
  Metadata: true,
  Notifications: true,
  Player: true,
  Posts: true,
  Pricing: true,
  PricingPage: true,
  Ai: true,
  About: true,
  Subject: true,
  School: true,
  SchoolEntry: true,
  SchoolGrades: true,
  SchoolGuardians: true,
  SchoolRoster: true,
  SchoolSettings: true,
  SchoolStart: true,
  SEO: true,
  Toast: true,
  Tryouts: true,
  Utils: true,
  Videos: true,
  Weather: true,
  NotFound: true,
  Error: true,
  State: true,
} satisfies Record<string, true>;

/** The namespaces that the dictionaries define, as literal names. */
export const MESSAGE_NAMESPACES = Rec.keys(messageNamespaceFlags);

/** One message namespace, decoded from a route's declaration. */
export const MessageNamespaceSchema = Schema.Literals(MESSAGE_NAMESPACES);

export type MessageNamespace = typeof MessageNamespaceSchema.Type;

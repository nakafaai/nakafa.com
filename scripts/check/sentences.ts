import { HashSet, pipe, String as Str } from "effect";

/**
 * The messages that take one sentence: each card description, card footer
 * sentence, dialog description, empty-state description, failure message and
 * answer of a question list. A message is listed by the component that renders
 * it, and its key is the dotted path of its dictionary entry, such as
 * `Memory.empty-description` or `Ai.failures.unknown`. In every dictionary each
 * listed message is one concise sentence, and a question ends with a question
 * mark. Titles, headings and metadata are not listed.
 */
export const SENTENCE_KEYS = HashSet.make(
  "Ai.chat-failed-description",
  "Ai.chat-unavailable",
  "Ai.delete-chat-description",
  "Ai.failures.content-blocked",
  "Ai.failures.input-too-large",
  "Ai.failures.interrupted",
  "Ai.failures.provider-busy",
  "Ai.failures.provider-unavailable",
  "Ai.failures.request-rejected",
  "Ai.failures.response-limit",
  "Ai.failures.response-timeout",
  "Ai.failures.service-configuration",
  "Ai.failures.unknown",
  "Ai.new-chat-description",
  "Ai.private-description",
  "Ai.public-description",
  "Ai.share-chat-description",
  "Ai.share-link-error",
  "Ai.sheet-description",
  "AnalyticsConsent.description",
  "AnalyticsConsent.load-error",
  "AnalyticsConsent.policy",
  "AnalyticsConsent.prompt-description",
  "AnalyticsConsent.runtime-error",
  "AnalyticsConsent.save-error",
  "AnalyticsConsent.status-browser-signal",
  "AnalyticsConsent.status-denied",
  "AnalyticsConsent.status-granted",
  "AnalyticsConsent.status-pending",
  "AnalyticsConsent.status-prompt",
  "Auth.bio-description",
  "Auth.bio-footer",
  "Auth.bio-too-long",
  "Auth.credits-description",
  "Auth.credits-free-footer",
  "Auth.credits-pro-footer",
  "Auth.curriculum-description",
  "Auth.curriculum-footer",
  "Auth.delete-account-description",
  "Auth.delete-account-dialog-description",
  "Auth.delete-account-error",
  "Auth.delete-account-footer",
  "Auth.delete-account-session-expired",
  "Auth.memory-description",
  "Auth.name-description",
  "Auth.name-footer",
  "Auth.picture-description",
  "Auth.picture-footer-animal",
  "Auth.plan-free-footer",
  "Auth.plan-granted-description",
  "Auth.plan-granted-footer",
  "Auth.plan-pro-description",
  "Auth.plan-pro-ending-description",
  "Auth.plan-pro-footer",
  "Auth.plan-pro-past-due-description",
  "Auth.plan-pro-past-due-footer",
  "Auth.role-description",
  "Auth.role-footer",
  "Auth.subscriptions-description",
  "Auth.username-description",
  "Auth.username-footer",
  "Classroom.add-channel-description",
  "Classroom.channels-empty-description",
  "Comments.delete-description",
  "Common.contributor-description",
  "Common.load-error",
  "Editor.image-add-description",
  "Editor.image-edit-description",
  "Error.description",
  "Exams.release-description",
  "Exams.results-counted",
  "Exams.results-empty",
  "Exams.results-incomplete",
  "Exams.results-no-answers",
  "Exams.rooms-empty-description",
  "Exams.rooms-filter-empty-description",
  "Exams.student-results-footer",
  "Exams.student-results-released",
  "Exams.try-note",
  "Landing.faq-account-answer",
  "Landing.faq-accuracy-answer",
  "Landing.faq-credits-answer",
  "Landing.faq-data-answer",
  "Landing.faq-empty-answer",
  "Landing.faq-languages-answer",
  "Landing.faq-memory-answer",
  "Landing.faq-nina-answer",
  "Landing.faq-phone-answer",
  "Landing.faq-subjects-answer",
  "Landing.school-lead",
  "Memory.clear-description",
  "Memory.delete-description",
  "Memory.empty-description",
  "Memory.footer",
  "NotFound.description",
  "Posts.delete-description",
  "PricingPage.a10",
  "PricingPage.a11",
  "PricingPage.a12",
  "PricingPage.a13",
  "PricingPage.a14",
  "PricingPage.a15",
  "PricingPage.a16",
  "PricingPage.a17",
  "PricingPage.a6",
  "PricingPage.a9",
  "SchoolEntry.outsider-description",
  "SchoolSettings.card-code-description",
  "SchoolSettings.cohort-edit-description",
  "SchoolSettings.invite-dialog-description",
  "SchoolSettings.invite-footer",
  "SchoolSettings.login-rename-description",
  "SchoolSettings.members-empty-description",
  "SchoolSettings.period-edit-description",
  "SchoolSettings.person-rename-description",
  "SchoolSettings.roster-entry-description",
  "SchoolSettings.student-add-description",
  "SchoolSettings.student-add-footer",
  "Toast.failure-context.description",
  "Toast.failure-request-conflict.description",
  "Tryouts.complete-part-description",
  "Tryouts.free-dialog-description",
  "Tryouts.free-entry-dialog-description",
  "Tryouts.paywall-description",
  "Tryouts.restart-dialog-description",
  "Tryouts.restart-entry-dialog-description",
  "Tryouts.start-dialog-description",
  "Tryouts.start-entry-dialog-description"
);

/** A sentence ends with a period, a question mark or an exclamation mark, optionally followed by a closing quote. */
const SENTENCE_END = /[.?!]["'”’»]?$/u;

/** A second sentence starts where a period, question mark or exclamation mark is followed by a space and a capital letter. */
const SENTENCE_START = /[.?!] \p{Lu}/u;

/** An ICU argument such as `{address}`, including one level of nested arguments such as plural forms. */
const ICU_ARGUMENT = /\{(?:[^{}]|\{[^{}]*\})*\}/gu;

/** Math between two dollar signs. */
const MATH = /\$[^$]*\$/gu;

/** Whether a second sentence starts inside a message. The inside of an ICU argument and of math does not count. */
export function holdsSecondSentence(text: string) {
  return SENTENCE_START.test(
    pipe(text, Str.replaceAll(ICU_ARGUMENT, ""), Str.replaceAll(MATH, ""))
  );
}

/** Whether a message is one sentence: it ends with a sentence end, and no second sentence starts inside it. */
export function isOneSentence(text: string) {
  return SENTENCE_END.test(text) && !holdsSecondSentence(text);
}

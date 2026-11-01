import { ANALYTICS_CONSENT_ROOT_ATTRIBUTE } from "@repo/analytics/consent";
import { CardContent } from "@repo/design-system/components/ui/card";
import { lazy } from "@repo/design-system/lib/lazy";
import { Suspense } from "react";
import { useTranslations } from "use-intl";
import {
  ConsentActions,
  ConsentDetails,
} from "@/components/analytics/consent/details";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import type { AnalyticsConsentContextValue } from "@/lib/analytics/consent/context";

/** Names the prompt section, so the hide rules below can match it. */
const PROMPT_ATTRIBUTE = "data-analytics-consent-prompt";

/**
 * The prompt's attributes. The prompt is in the first HTML of every page, so a search
 * engine quoted it as the snippet of a thin page until it was marked as no snippet.
 */
const promptAttributes = { [PROMPT_ATTRIBUTE]: "", "data-nosnippet": "" };

/**
 * Hides the prompt while the document root carries the mark that the bootstrap
 * writes before paint. The root attribute's name comes from the shared consent
 * module, so this rule cannot drift from the script.
 */
const HIDE_PROMPT_WHILE_MARKED = `:root[${ANALYTICS_CONSENT_ROOT_ATTRIBUTE}] [${PROMPT_ATTRIBUTE}]{display:none}`;

/**
 * Hides the prompt while a page holds the shell locked, as a running try-out section and a School
 * sitting do. It stands over the question and the next button of a timed paper, and it returns
 * once the learner leaves the paper.
 */
const HIDE_PROMPT_WHILE_LOCKED = `:root:has([data-slot="sidebar-wrapper"][data-locked],[data-shell-lock]) [${PROMPT_ATTRIBUTE}]{display:none}`;

/**
 * Hides the prompt where scripts are off. Nothing runs there to record a choice,
 * so the buttons could never work.
 */
const HIDE_PROMPT_WITHOUT_SCRIPTS = `[${PROMPT_ATTRIBUTE}]{display:none}`;

/**
 * The preferences dialog ships as its own chunk. Its footer control warms it on
 * hover, focus or press, so the root layout never carries the dialog's code.
 */
const ConsentPreferences = lazy(() =>
  import("@/components/analytics/consent/preferences").then((module) => ({
    default: module.ConsentPreferences,
  }))
);

/**
 * Renders the non-blocking first decision and permanent preferences dialog.
 *
 * The server renders the prompt while the choice is pending, so the text is in
 * the first HTML. The bootstrap script marks the root before paint for a signed-in
 * visitor, and for a visitor whose choice this browser keeps; the consent provider
 * marks a page the server did not render the same way. The store removes the mark
 * once it knows the choice, so a signed-in visitor never sees the prompt before the
 * account is known. Without scripts the prompt stays hidden.
 *
 * The consent state is derived once here and handed to the decision and
 * detail parts, which render in both the prompt and the dialog.
 */
export function AnalyticsConsentControls({
  consent,
}: {
  consent: AnalyticsConsentContextValue;
}) {
  const t = useTranslations("AnalyticsConsent");

  if (!consent.isAvailable) {
    return null;
  }

  return (
    <>
      <style>{`${HIDE_PROMPT_WHILE_MARKED}${HIDE_PROMPT_WHILE_LOCKED}`}</style>
      <noscript>
        <style>{HIDE_PROMPT_WITHOUT_SCRIPTS}</style>
      </noscript>
      {consent.isPromptOpen ? (
        <section
          {...promptAttributes}
          aria-label={t("title")}
          className="fixed right-4 bottom-4 left-4 z-50 sm:right-6 sm:bottom-6 sm:left-auto sm:w-full sm:max-w-md"
        >
          <CardSection
            className="max-h-[calc(100dvh-2rem)] shadow-lg"
            description={t("prompt-description")}
            size="sm"
            title={t("title")}
          >
            <div className="min-h-0 flex-1 overflow-y-auto">
              <CardContent>
                <ConsentDetails error={consent.error} />
              </CardContent>
            </div>
            <CardSectionFooter hint={t("prompt-footer")}>
              <CardSectionActions>
                <ConsentActions
                  canDecline={consent.canDecline}
                  canGrant={consent.canGrant}
                  decide={consent.decide}
                />
              </CardSectionActions>
            </CardSectionFooter>
          </CardSection>
        </section>
      ) : null}

      {consent.preferencesWarm ? (
        <Suspense fallback={null}>
          <ConsentPreferences consent={consent} />
        </Suspense>
      ) : null}
    </>
  );
}

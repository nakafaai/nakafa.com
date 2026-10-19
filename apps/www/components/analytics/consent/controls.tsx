"use client";

import { ANALYTICS_CONSENT_ROOT_ATTRIBUTE } from "@repo/analytics/consent";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import {
  ConsentActions,
  ConsentDetails,
} from "@/components/analytics/consent/details";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { useAnalyticsConsent } from "@/lib/analytics/consent/context";

/** Names the prompt section, so the hide rules below can match it. */
const PROMPT_ATTRIBUTE = "data-analytics-consent-prompt";
const promptAttributes = { [PROMPT_ATTRIBUTE]: "" };

/**
 * Hides the prompt while the document root carries the mark that the bootstrap
 * writes before paint. The root attribute's name comes from the shared consent
 * module, so this rule cannot drift from the script.
 */
const HIDE_PROMPT_WHILE_MARKED = `:root[${ANALYTICS_CONSENT_ROOT_ATTRIBUTE}] [${PROMPT_ATTRIBUTE}]{display:none}`;

/**
 * Hides the prompt where scripts are off. Nothing runs there to record a choice,
 * so the buttons could never work.
 */
const HIDE_PROMPT_WITHOUT_SCRIPTS = `[${PROMPT_ATTRIBUTE}]{display:none}`;

/**
 * The preferences dialog ships as its own chunk. Its footer control warms it on
 * hover, focus or press, so the root layout never carries the dialog's code.
 */
const ConsentPreferences = dynamic(() =>
  import("@/components/analytics/consent/preferences").then(
    (module) => module.ConsentPreferences
  )
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
export function AnalyticsConsentControls() {
  const t = useTranslations("AnalyticsConsent");
  const consent = useAnalyticsConsent((state) => state);

  if (!consent.isAvailable) {
    return null;
  }

  const actions = (
    <ConsentActions
      canDecline={consent.canDecline}
      canGrant={consent.canGrant}
      decide={consent.decide}
    />
  );

  return (
    <>
      <style>{HIDE_PROMPT_WHILE_MARKED}</style>
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
            size="sm"
          >
            <CardHeader>
              <CardTitle>{t("title")}</CardTitle>
              <CardDescription>{t("prompt-description")}</CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto">
              <ConsentDetails error={consent.error} />
            </CardContent>
            <CardSectionFooter hint={t("prompt-footer")}>
              <CardSectionActions>{actions}</CardSectionActions>
            </CardSectionFooter>
          </CardSection>
        </section>
      ) : null}

      {consent.preferencesWarm ? <ConsentPreferences /> : null}
    </>
  );
}

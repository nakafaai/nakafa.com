import type { Locale } from "@repo/internationalization/src/locale";
import { Missing } from "@/components/state/missing";
import { ActionNavigation } from "@/components/state/navigation";
import { Stage } from "@/components/state/stage";
import { readStandaloneMessages } from "@/lib/i18n/standalone";
import { LANDING_TARGET, SEARCH_TARGET } from "@/lib/routing/target";

/**
 * The not-found state of a page inside the app. Its two ways on navigate in the
 * app, so the app stays loaded, as the reference app's locale not-found does. The
 * standalone not-found page uses plain anchors instead, so it never loads this
 * module or the app's navigation.
 */
export function AppNotFound({ locale }: { readonly locale: Locale }) {
  const messages = readStandaloneMessages(locale);
  return (
    <Stage>
      <Missing
        description={messages.NotFound.description}
        title={messages.NotFound.title}
      >
        <ActionNavigation
          label={messages.State["home-button"]}
          target={LANDING_TARGET}
          variant="default"
        />
        <ActionNavigation
          label={messages.NotFound["search-button"]}
          target={SEARCH_TARGET}
          variant="ghost"
        />
      </Missing>
    </Stage>
  );
}

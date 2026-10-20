import { Logout01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { localizeInternalHref } from "@repo/internationalization/src/href";
import { useCurrentLocale } from "@repo/internationalization/src/link";
import { Effect, Result } from "effect";
import { useTranslations } from "use-intl";
import { clearAiDraftText } from "@/components/ai/store/draft";
import { signOutAccountBrowserIdentity } from "@/lib/auth/identity/browser";
export function AuthLogout() {
  const t = useTranslations("Auth");
  const locale = useCurrentLocale();
  /** Signs the user out and returns them to the public home page on success. */
  async function handleSignOut() {
    const result = await Effect.runPromise(
      Effect.result(signOutAccountBrowserIdentity())
    );
    if (Result.isSuccess(result)) {
      Effect.runSync(clearAiDraftText);
      // Sign-out is a full document load, which closes the live session and clears every store.
      window.location.replace(localizeInternalHref("/", locale));
    }
  }
  return (
    <Button onClick={handleSignOut}>
      <HugeIcons icon={Logout01Icon} />
      {t("logout")}
    </Button>
  );
}

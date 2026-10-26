import { Logout01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { toast } from "@repo/design-system/lib/toast/notify";
import { localizeInternalHref } from "@repo/internationalization/src/href";
import { Effect, Result } from "effect";
import { useTranslations } from "use-intl";
import { clearAiDraftText } from "@/components/ai/store/draft";
import { signOutAccountBrowserIdentity } from "@/lib/auth/identity/browser";
import { useCurrentLocale } from "@/lib/routing/link";
export function AuthLogout() {
  const t = useTranslations("Auth");
  const locale = useCurrentLocale();
  /**
   * Signs the user out, then opens the locale home as a full document load, which
   * closes the live session and resets every store. A failed sign-out says so,
   * because the account is still signed in.
   */
  async function handleSignOut() {
    const result = await Effect.runPromise(
      Effect.result(signOutAccountBrowserIdentity())
    );
    if (Result.isSuccess(result)) {
      Effect.runSync(clearAiDraftText);
      window.location.replace(localizeInternalHref("/", locale));
      return;
    }
    toast.error({
      description: "sign-out-error.description",
      title: "sign-out-error.title",
    });
  }
  return (
    <Button onClick={handleSignOut}>
      <HugeIcons icon={Logout01Icon} />
      {t("logout")}
    </Button>
  );
}

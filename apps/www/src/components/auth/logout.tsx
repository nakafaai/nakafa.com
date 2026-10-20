import { Logout01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Effect, Result } from "effect";
import { useLocale, useTranslations } from "use-intl";
import { clearAiDraftText } from "@/components/ai/store/draft";
import { signOutAccountBrowserIdentity } from "@/lib/auth/identity/browser";
export function AuthLogout() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  /** Signs the user out, then opens the locale home as a full document load, which closes the socket and resets every store. */
  async function handleSignOut() {
    const result = await Effect.runPromise(
      Effect.result(signOutAccountBrowserIdentity())
    );
    if (Result.isSuccess(result)) {
      Effect.runSync(clearAiDraftText);
      window.location.assign(`/${locale}`);
    }
  }
  return (
    <Button onClick={handleSignOut}>
      <HugeIcons icon={Logout01Icon} />
      {t("logout")}
    </Button>
  );
}

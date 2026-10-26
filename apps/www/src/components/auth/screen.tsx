import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { EntryShellBody } from "@/components/entry/shell";

/**
 * The sign-in body of the main site and of a school host. The page passes its
 * title as `children` and its sign-in control as `action`: the main site's
 * control also sends on a visitor who is already signed in, and a school's
 * returns the visitor to the school root. The page also passes the figure above the
 * title: Nina on the main site, and the school's own mark on a school host. The body
 * adds the sentence that says why signing in keeps progress saved, under which the
 * page puts its privacy and terms sentence (`AuthLegal`).
 */
export function SignInScreen({
  action,
  children,
  figure,
  legal,
}: {
  action: ReactNode;
  children: ReactNode;
  /** What stands above the title: Nina on the main site, the school's mark on a school host. */
  figure: ReactNode;
  /** The privacy and terms sentence, with the addresses that the route loader read for this locale. */
  legal: ReactNode;
}) {
  const t = useTranslations("Auth");

  return (
    <EntryShellBody>
      {figure}

      <div className="flex flex-col items-center gap-2 text-center">
        {children}
        <p className="text-muted-foreground">{t("sign-in-description")}</p>
      </div>

      {action}

      {legal}
    </EntryShellBody>
  );
}

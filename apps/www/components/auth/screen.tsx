import { Nina } from "@repo/design-system/components/ui/nina";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AuthLegal } from "@/components/auth/legal";
import { EntryShellBody } from "@/components/entry/shell";

/**
 * The sign-in body of the main site and of a school host. The page passes its
 * title as `children` and its sign-in control as `action`: the main site's
 * control also signs out a visitor who is already signed in, and a school's
 * returns the visitor to the school root. The body adds Nina, the sentence that
 * says why signing in keeps progress saved, and the privacy and terms sentence.
 */
export async function SignInScreen({
  action,
  children,
}: {
  action: ReactNode;
  children: ReactNode;
}) {
  const t = await getTranslations("Auth");

  return (
    <EntryShellBody>
      <Nina
        act="relaxed"
        fidget={["waving"]}
        label=""
        mood="hello"
        size={190}
        whole
      />

      <div className="flex flex-col items-center gap-2 text-center">
        {children}
        <p className="text-muted-foreground">{t("sign-in-description")}</p>
      </div>

      {action}

      <AuthLegal />
    </EntryShellBody>
  );
}

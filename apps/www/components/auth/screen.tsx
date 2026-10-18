import { Nina } from "@repo/design-system/components/ui/nina";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AuthGoogle } from "@/components/auth/google";
import { AuthLegal } from "@/components/auth/legal";
import { EntryShellBody } from "@/components/entry/shell";

/**
 * The sign-in body of the main site and of a school host. The page passes its
 * title as `children`. The body adds Nina, the sentence that says why signing in
 * keeps progress saved, the Google button, and the privacy and terms sentence.
 * `returnPath` is the path on the host the visitor signs in from, as `AuthGoogle`
 * describes it.
 */
export async function SignInScreen({
  children,
  returnPath,
}: {
  children: ReactNode;
  returnPath?: string;
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

      <AuthGoogle returnPath={returnPath} />

      <AuthLegal />
    </EntryShellBody>
  );
}

import { Nina } from "@repo/design-system/components/ui/nina";
import { getTranslations } from "next-intl/server";
import { Auth } from "@/components/auth";
import { SignInScreen } from "@/components/auth/screen";
import { EntryShellHeader } from "@/components/entry/shell";
import { BackButton } from "@/components/shared/back";
import { ThemePicker } from "@/components/shared/theme/picker";

export default async function Page() {
  const t = await getTranslations("Auth");

  return (
    <>
      <EntryShellHeader>
        <BackButton />

        <ThemePicker variant="ghost" />
      </EntryShellHeader>
      <SignInScreen
        action={<Auth />}
        figure={
          <Nina
            act="relaxed"
            fidget={["waving"]}
            label=""
            mood="hello"
            size={190}
            whole
          />
        }
      >
        <h1 className="font-semibold text-2xl">{t("sign-in-title")}</h1>
      </SignInScreen>
    </>
  );
}

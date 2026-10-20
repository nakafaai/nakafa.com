import type { Mascot } from "@repo/mascot/code";
import { useTranslations } from "use-intl";
import { EntryShellArtwork } from "@/components/entry/artwork";
import {
  EntryShell,
  EntryShellBody,
  EntryShellHeader,
  EntryShellPanel,
} from "@/components/entry/shell";
import { ThemePicker } from "@/components/shared/theme/picker";
import { SchoolMark } from "@/components/tenant/mark";
import { TenantOutsiderActions } from "@/components/tenant/leave";

/**
 * The page of a signed-in visitor who is not a member of the school. It names the account,
 * says where an invite may still be on its way and how an address without Google signs in,
 * and offers the ways out. It reuses the entry frame, so the visitor sees the school's own
 * mark, as a signed-out visitor does.
 */
export function TenantOutsider({
  account,
  logo,
  mascot,
  school,
}: {
  account: string;
  logo: string | undefined;
  mascot: typeof Mascot.Type;
  school: string;
}) {
  const t = useTranslations("SchoolEntry");

  return (
    <EntryShell>
      <EntryShellPanel>
        <EntryShellHeader>
          <div className="ms-auto">
            <ThemePicker variant="ghost" />
          </div>
        </EntryShellHeader>

        <EntryShellBody>
          <SchoolMark logo={logo} mascot={mascot} size="lg" />

          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="font-semibold text-2xl">{t("outsider-title")}</h1>
            <p className="text-muted-foreground">
              {t("outsider-description", { account, school })}
            </p>
            <p className="text-muted-foreground text-sm">
              {t("outsider-hint")}
            </p>
            <p className="text-muted-foreground text-sm">
              {t("outsider-card-hint")}
            </p>
          </div>

          <TenantOutsiderActions />
        </EntryShellBody>
      </EntryShellPanel>
      <EntryShellArtwork />
    </EntryShell>
  );
}

import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useTranslations } from "next-intl";
import { Theme } from "@/components/marketing/shared/footer-action";
import {
  EntryShell,
  EntryShellArtwork,
  EntryShellBody,
  EntryShellHeader,
  EntryShellPanel,
} from "@/components/shared/entry-shell";

/** Shows truthful progress while first-run admission resolves. */
export function AdmissionPending() {
  const t = useTranslations("Auth");

  return (
    <EntryShell>
      <EntryShellPanel>
        <EntryShellHeader>
          <div className="ms-auto">
            <Theme variant="ghost" />
          </div>
        </EntryShellHeader>
        <EntryShellBody>
          <div
            aria-busy="true"
            aria-live="polite"
            className="flex items-center gap-2 text-muted-foreground"
            role="status"
          >
            <Spinner aria-hidden="true" className="size-4" />
            <p>{t("preparing-account")}</p>
          </div>
        </EntryShellBody>
      </EntryShellPanel>
      <EntryShellArtwork />
    </EntryShell>
  );
}

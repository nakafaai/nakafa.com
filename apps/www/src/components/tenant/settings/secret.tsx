import { useClipboard } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { useTranslations } from "use-intl";

/** One value the reader copies, under its name. */
function IssuedValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-sm">{label}</span>
      <code className="bg-muted rounded-md p-3 text-sm break-all">{value}</code>
    </div>
  );
}

/**
 * Shows one secret that the server answered once, with a copy action, and the ID a
 * system sends with it when it has one. The dialog is open while there is a secret, and
 * closing it leaves no copy of the secret on the page, because the server does not show
 * it again.
 */
export function SchoolSecretDialog({
  description,
  identifier,
  onClose,
  secret,
  title,
}: {
  description: string;
  identifier?: string | undefined;
  onClose: () => void;
  secret: string | undefined;
  title: string;
}) {
  const t = useTranslations("SchoolSettings");
  const clipboard = useClipboard({ timeout: 1500 });

  return (
    <ResponsiveDialog
      description={description}
      footer={
        <Button
          onClick={() => {
            if (secret !== undefined) {
              clipboard.copy(secret);
            }
          }}
          type="button"
        >
          {t("secret-copy")}
        </Button>
      }
      open={secret !== undefined}
      setOpen={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title={title}
    >
      <div className="flex flex-col gap-4">
        {identifier === undefined ? null : (
          <IssuedValue label={t("client-id")} value={identifier} />
        )}
        <IssuedValue label={t("secret-label")} value={secret ?? ""} />
      </div>
    </ResponsiveDialog>
  );
}

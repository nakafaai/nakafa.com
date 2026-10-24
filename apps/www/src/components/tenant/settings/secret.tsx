import { useClipboard } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { useTranslations } from "use-intl";

/**
 * Shows one secret that the server answered once, with a copy action. The dialog
 * is open while there is a secret, and closing it leaves no copy of the secret on
 * the page, because the server does not show it again.
 */
export function SchoolSecretDialog({
  description,
  onClose,
  secret,
  title,
}: {
  description: string;
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
      <code className="break-all rounded-md bg-muted p-3 text-sm">
        {secret}
      </code>
    </ResponsiveDialog>
  );
}

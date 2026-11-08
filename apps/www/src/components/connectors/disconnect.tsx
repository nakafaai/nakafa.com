import { Plug01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogSubject,
} from "@repo/design-system/components/ui/responsive-dialog";
import { useTranslations } from "use-intl";
import { useConnectorActions } from "@/components/connectors/actions";
import type { Connection } from "@/components/connectors/optimistic";

/** Asks before a connection ends, then ends it at once. `name` is the service the connection serves. */
export function DisconnectDialog({
  connection,
  name,
  open,
  setOpen,
}: {
  connection: Connection;
  name: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("Connectors");
  const { disconnect } = useConnectorActions();

  return (
    <ResponsiveDialog
      action={
        <Button
          onClick={() => {
            setOpen(false);
            disconnect(connection);
          }}
          variant="destructive"
        >
          {t("disconnect")}
        </Button>
      }
      description={t("disconnect-description")}
      open={open}
      setOpen={setOpen}
      title={t("disconnect-title", { name })}
    >
      <ResponsiveDialogSubject icon={Plug01Icon}>
        {name}
      </ResponsiveDialogSubject>
    </ResponsiveDialog>
  );
}

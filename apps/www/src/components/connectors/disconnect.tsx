import { Button } from "@repo/design-system/components/ui/button";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
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
  const common = useTranslations("Common");
  const { disconnect } = useConnectorActions();

  return (
    <ResponsiveDialog
      description={t("disconnect-description")}
      footer={
        <>
          <Button onClick={() => setOpen(false)} variant="outline">
            {common("cancel")}
          </Button>
          <Button
            onClick={() => {
              setOpen(false);
              disconnect(connection);
            }}
            variant="destructive"
          >
            {t("disconnect")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("disconnect-title", { name })}
    />
  );
}

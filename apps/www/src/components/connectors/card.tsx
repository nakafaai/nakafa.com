import {
  Calendar03Icon,
  GoogleDriveIcon,
  Mortarboard01Icon,
} from "@hugeicons/core-free-icons";
import type { GoogleConnector } from "@repo/backend/confect/connectors/google/manifest";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Option } from "effect";
import { useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import type { Connection } from "@/components/connectors/optimistic";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";

/** The icon of each Google connector. */
const CONNECTOR_ICONS = {
  calendar: Calendar03Icon,
  classroom: Mortarboard01Icon,
  drive: GoogleDriveIcon,
};

/**
 * One Google connector: what it reads, and where its connection stands. Connect
 * sends the browser to Google's consent screen and stays pending until the page
 * leaves; a connection that Google stopped accepting asks to connect again;
 * Disconnect asks first, then ends the connection at once.
 */
export function ConnectorCard({
  connection,
  connector,
  onConnect,
  onDisconnect,
}: {
  connection: Option.Option<Connection>;
  connector: GoogleConnector;
  onConnect: () => Promise<void>;
  onDisconnect: (connection: Connection) => void;
}) {
  const t = useTranslations("Connectors");
  const common = useTranslations("Common");
  const [isConnecting, startConnecting] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const reconnect = Option.exists(
    connection,
    (found) => found.status === "reconnect"
  );
  const connect = (
    <Button
      disabled={isConnecting}
      onClick={() => startConnecting(onConnect)}
      variant={Option.isSome(connection) ? "outline" : "default"}
    >
      {reconnect ? t("reconnect") : t("connect")}
    </Button>
  );

  return (
    <CardSection>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HugeIcons aria-hidden="true" icon={CONNECTOR_ICONS[connector]} />
          {t(connector)}
        </CardTitle>
        <CardDescription>{t(`${connector}-description`)}</CardDescription>
      </CardHeader>
      <CardSectionFooter
        hint={Option.match(connection, {
          onNone: () => t("not-connected"),
          onSome: () => (reconnect ? t("reconnect-hint") : t("connected")),
        })}
        tone={reconnect ? "destructive" : "muted"}
      >
        {Option.isNone(connection) ? (
          connect
        ) : (
          <>
            {reconnect ? connect : null}
            <Button onClick={() => setConfirming(true)} variant="destructive">
              {t("disconnect")}
            </Button>
            <ResponsiveDialog
              description={t("disconnect-description")}
              footer={
                <>
                  <Button
                    onClick={() => setConfirming(false)}
                    variant="outline"
                  >
                    {common("cancel")}
                  </Button>
                  <Button
                    onClick={() => {
                      setConfirming(false);
                      onDisconnect(connection.value);
                    }}
                    variant="destructive"
                  >
                    {t("disconnect")}
                  </Button>
                </>
              }
              open={confirming}
              setOpen={setConfirming}
              title={t("disconnect-title", { name: t(connector) })}
            />
          </>
        )}
      </CardSectionFooter>
    </CardSection>
  );
}

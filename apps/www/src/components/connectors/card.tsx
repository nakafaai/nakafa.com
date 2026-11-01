import {
  Calendar03Icon,
  GoogleDriveIcon,
  Mortarboard01Icon,
} from "@hugeicons/core-free-icons";
import type { GoogleConnector } from "@repo/backend/confect/connectors/google/manifest";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Option } from "effect";
import { use, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import {
  ConnectOutcomeContext,
  useConnectorActions,
} from "@/components/connectors/actions";
import { DisconnectDialog } from "@/components/connectors/disconnect";
import type { Connection } from "@/components/connectors/optimistic";
import { connectFailure } from "@/components/connectors/outcome";
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
 * a connect that just ended badly says so here; Disconnect asks first, then ends
 * the connection at once.
 */
export function ConnectorCard({
  connection,
  connector,
}: {
  connection: Option.Option<Connection>;
  connector: GoogleConnector;
}) {
  const t = useTranslations("Connectors");
  const [confirming, setConfirming] = useState(false);
  const reconnect = Option.exists(
    connection,
    (found) => found.status === "reconnect"
  );
  const failure = Option.filter(
    connectFailure(use(ConnectOutcomeContext), connector),
    () => Option.isNone(connection)
  );

  return (
    <CardSection
      description={t(`${connector}-description`)}
      title={
        <span className="flex items-center gap-2">
          <HugeIcons aria-hidden="true" icon={CONNECTOR_ICONS[connector]} />
          {t(connector)}
        </span>
      }
    >
      <CardSectionFooter
        hint={Option.match(connection, {
          onNone: () =>
            Option.match(failure, {
              onNone: () => t("not-connected"),
              onSome: (ended) => t(`status-${ended}`),
            }),
          onSome: () => (reconnect ? t("reconnect-hint") : t("connected")),
        })}
        tone={reconnect || Option.isSome(failure) ? "destructive" : "muted"}
      >
        {Option.isNone(connection) ? (
          <ConnectButton connector={connector} reconnect={false} />
        ) : (
          <>
            {reconnect ? (
              <ConnectButton connector={connector} reconnect={true} />
            ) : null}
            <Button onClick={() => setConfirming(true)} variant="destructive">
              {t("disconnect")}
            </Button>
            <DisconnectDialog
              connection={connection.value}
              name={t(connector)}
              open={confirming}
              setOpen={setConfirming}
            />
          </>
        )}
      </CardSectionFooter>
    </CardSection>
  );
}

/**
 * Starts a connect at Google: the main action of a card without a connection, and the way back
 * for one whose token Google stopped accepting. It stays pressed while the start runs.
 */
function ConnectButton({
  connector,
  reconnect,
}: {
  connector: GoogleConnector;
  reconnect: boolean;
}) {
  const t = useTranslations("Connectors");
  const { connect } = useConnectorActions();
  const [isConnecting, startConnecting] = useTransition();

  return (
    <Button
      disabled={isConnecting}
      onClick={() => startConnecting(() => connect(connector))}
      variant={reconnect ? "outline" : "default"}
    >
      {reconnect ? t("reconnect") : t("connect")}
    </Button>
  );
}

import { Key01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { useTranslations } from "use-intl";
import { useSittingData } from "@/components/exams/sitting/context";
import { roomJoinAddress } from "@/components/exams/sitting/join";
import { QrImage } from "@/components/shared/qr/image";

/**
 * The room's code for the proctor to show the class: the QR code that opens the sitting with its
 * token, and the token in large letters for a student who types it. Change token asks first and
 * then comes back here with the new code.
 */
export function JoinRoomDialog({
  onChangeToken,
  onOpenChange,
  open,
}: {
  readonly onChangeToken: () => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
}) {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");

  return (
    <ResponsiveDialog
      description={t("join-description")}
      footer={
        <>
          <Button onClick={onChangeToken} type="button" variant="outline">
            <HugeIcons icon={Key01Icon} />
            {t("change-token")}
          </Button>
          <Button onClick={() => onOpenChange(false)} type="button">
            {common("close")}
          </Button>
        </>
      }
      open={open}
      setOpen={onOpenChange}
      title={t("join-title")}
    >
      <RoomCode />
    </ResponsiveDialog>
  );
}

/**
 * The QR code and the token, large enough to read from the back of the room. The dialog draws it
 * only while it is open, in the browser, so the address it encodes is the host the proctor is on.
 */
function RoomCode() {
  const t = useTranslations("Exams");
  const { sittingId, value } = useSittingData();

  if (value.token === null) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-6 py-2">
      <QrImage
        label={t("join-qr-label")}
        size="room"
        text={roomJoinAddress(window.location.origin, sittingId, value.token)}
      />
      <p
        className="font-medium font-mono text-5xl tabular-nums tracking-widest"
        translate="no"
      >
        {value.token}
      </p>
    </div>
  );
}

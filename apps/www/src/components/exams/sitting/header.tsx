import type { GenericId } from "@confect/core";
import { CancelCircleIcon, QrCodeIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useState } from "react";
import { useTranslations } from "use-intl";
import {
  useMayProctor,
  useSittingData,
} from "@/components/exams/sitting/context";
import {
  ChangeTokenDialog,
  CloseSittingDialog,
} from "@/components/exams/sitting/dialogs";
import { JoinRoomDialog } from "@/components/exams/sitting/room";
import { SplitMenuTrigger } from "@/components/shared/split";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { Link } from "@/lib/routing/link";
import {
  schoolExamsTarget,
  schoolExamTarget,
} from "@/lib/routing/school/target";

/**
 * The one header of the dashboard: the sidebar's trigger, the path from the exams through the
 * exam, whose link returns to the exam's rooms, to the sitting's room, and at its end the
 * proctor's token, which opens the room's QR code and Change token, with Close sitting in its menu.
 * The exams crumb is left out for a viewer who may not open the exam list. The page carries the
 * token only for a proctor, and the actions show only when the page lists them and the sitting is
 * not closed, since nobody joins or closes a closed sitting.
 */
export function SittingHeader({
  examId,
}: {
  readonly examId: GenericId.GenericId<"exams">;
}) {
  const t = useTranslations("Exams");
  const tenant = useTenant();
  const { value } = useSittingData();
  const mayProctor = useMayProctor();
  const [dialog, setDialog] = useState<"close" | "join" | "token" | null>(null);

  return (
    <SchoolHeader
      items={[
        ...(tenant.canOpenExams
          ? [
              {
                label: t("title"),
                target: schoolExamsTarget(tenant.slug),
              },
            ]
          : []),
        {
          label: value.sitting.examTitle,
          target: schoolExamTarget(tenant.slug, examId),
        },
        { label: value.sitting.room },
      ]}
      title={value.sitting.room}
    >
      {value.sitting.state === "closed" && value.canViewResults ? (
        <Link
          className={buttonVariants({ variant: "outline" })}
          params={{
            exam: examId,
            sitting: value.sitting.id,
            slug: tenant.slug,
          }}
          to="/school/$slug/exams/$exam/sittings/$sitting/results"
        >
          {t("results-title")}
        </Link>
      ) : null}
      {mayProctor &&
      value.token !== null &&
      value.sitting.state !== "closed" ? (
        <SittingProctorActions onOpen={setDialog} token={value.token} />
      ) : null}
      <JoinRoomDialog
        onChangeToken={() => setDialog("token")}
        onOpenChange={(open) => setDialog(open ? "join" : null)}
        open={dialog === "join"}
      />
      {/* Changing the token comes back to the room's code, which then shows the new one. */}
      <ChangeTokenDialog
        onOpenChange={(open) => setDialog(open ? "token" : "join")}
        open={dialog === "token"}
      />
      <CloseSittingDialog
        onOpenChange={(open) => setDialog(open ? "close" : null)}
        open={dialog === "close"}
      />
    </SchoolHeader>
  );
}

/**
 * The proctor's actions as one group: the room's token, which opens its QR code for the class to
 * scan, and a menu with Close sitting, which ends the sitting once, at its end. The token stays
 * readable on a phone too, since a student may read it off the proctor's screen.
 */
function SittingProctorActions({
  onOpen,
  token,
}: {
  readonly onOpen: (dialog: "close" | "join") => void;
  readonly token: string;
}) {
  const t = useTranslations("Exams");

  return (
    <ButtonGroup>
      <Button
        aria-label={t("join-show", { token })}
        onClick={() => onOpen("join")}
        type="button"
        variant="outline"
      >
        <HugeIcons icon={QrCodeIcon} />
        <span className="font-mono tabular-nums tracking-widest" translate="no">
          {token}
        </span>
      </Button>
      <DropdownMenu>
        <SplitMenuTrigger />
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => onOpen("close")}
            variant="destructive"
          >
            <HugeIcons icon={CancelCircleIcon} />
            {t("close-sitting")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}

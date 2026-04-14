"use client";

import {
  Copy01Icon,
  Tick01Icon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useClass } from "@/lib/context/use-class";
import {
  type InviteRole,
  inviteRoleList,
  mapInviteCodesByRole,
} from "./invite-data";

/** Render the class invite flow for teacher and student join codes. */
export function SchoolClassesPeopleInvite() {
  const t = useTranslations("School.Classes");

  const classId = useClass((state) => state.class._id);

  const [openInviteDialog, setOpenInviteDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<InviteRole>("student");

  const clipboard = useClipboard({ timeout: 500 });

  const inviteCodes = useQuery(api.classes.queries.getInviteCodes, {
    classId,
  });

  const inviteCodesByRole = useMemo(
    () => mapInviteCodesByRole(inviteCodes),
    [inviteCodes]
  );

  const code = useMemo(
    () => inviteCodesByRole.get(selectedRole)?.code ?? "",
    [inviteCodesByRole, selectedRole]
  );

  return (
    <ButtonGroup>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>
            <HugeIcons icon={UserAdd01Icon} />
            {t("invite")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t("role")}</DropdownMenuLabel>
          <DropdownMenuGroup>
            {inviteRoleList.map((role) => (
              <DropdownMenuItem
                className="cursor-pointer"
                key={role.value}
                onSelect={() => {
                  setSelectedRole(role.value);
                  setOpenInviteDialog(true);
                }}
              >
                <HugeIcons icon={role.icon} />
                {t(role.value)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <InviteCodeDialog
        code={code}
        copied={clipboard.copied}
        onCopy={() => {
          if (!code) {
            return;
          }

          clipboard.copy(code);
          toast.success(t("invite-code-copied"), {
            position: "bottom-center",
          });
        }}
        open={openInviteDialog}
        role={selectedRole}
        setOpenAction={setOpenInviteDialog}
      />
    </ButtonGroup>
  );
}

/** Render the dialog that shows and copies one selected class invite code. */
function InviteCodeDialog({
  code,
  copied,
  onCopy,
  open,
  role,
  setOpenAction,
}: {
  code: string;
  copied: boolean;
  onCopy: () => void;
  open: boolean;
  role: InviteRole;
  setOpenAction: (open: boolean) => void;
}) {
  const t = useTranslations("School.Classes");

  return (
    <ResponsiveDialog
      description={t(`invite-${role}-description`)}
      footer={
        <Button onClick={onCopy}>
          <HugeIcons icon={copied ? Tick01Icon : Copy01Icon} />
          {t("copy")}
        </Button>
      }
      open={open}
      setOpen={setOpenAction}
      title={t(`invite-${role}-title`)}
    >
      <div className="flex items-center justify-center rounded-md border px-4 py-8">
        <p className="font-medium text-3xl tracking-tighter">{code}</p>
      </div>
    </ResponsiveDialog>
  );
}

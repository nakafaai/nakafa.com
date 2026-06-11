"use client";

import {
  Copy01Icon,
  Tick01Icon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons";
import { useClipboard, useDisclosure } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/overlays/responsive-dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { Group } from "@repo/design-system/components/ui/group";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "@repo/design-system/components/ui/menu";
import { toastManager } from "@repo/design-system/components/ui/toast";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  type InviteRole,
  inviteRoleList,
  mapInviteCodesByRole,
} from "@/components/school/classes/people/invite-data";
import { useClass } from "@/lib/context/use-class";

/** Render the class invite flow for teacher and student join codes. */
export function SchoolClassesPeopleInvite() {
  const t = useTranslations("School.Classes");

  const classId = useClass((state) => state.class._id);

  const [openInviteDialog, inviteDialogHandlers] = useDisclosure(false);
  const [selectedRole, setSelectedRole] = useState<InviteRole>("student");

  const clipboard = useClipboard({ timeout: 500 });

  const inviteCodes = useQuery(api.classes.queries.getInviteCodes, {
    classId,
  });

  const inviteCodesByRole = mapInviteCodesByRole(inviteCodes);

  const code = inviteCodesByRole.get(selectedRole)?.code ?? "";

  return (
    <Group>
      <Menu>
        <MenuTrigger
          render={
            <Button>
              <HugeIcons icon={UserAdd01Icon} />
              {t("invite")}
            </Button>
          }
        />
        <MenuPopup align="end">
          <MenuGroup>
            <MenuGroupLabel>{t("role")}</MenuGroupLabel>
            {inviteRoleList.map((role) => (
              <MenuItem
                className="cursor-pointer"
                key={role.value}
                onClick={() => {
                  setSelectedRole(role.value);
                  inviteDialogHandlers.open();
                }}
              >
                <HugeIcons icon={role.icon} />
                {t(role.value)}
              </MenuItem>
            ))}
          </MenuGroup>
        </MenuPopup>
      </Menu>

      <InviteCodeDialog
        code={code}
        copied={clipboard.copied}
        onCopy={() => {
          if (!code) {
            return;
          }

          clipboard.copy(code);
          toastManager.add({ type: "success", title: t("invite-code-copied") });
        }}
        open={openInviteDialog}
        role={selectedRole}
        setOpenAction={inviteDialogHandlers.set}
      />
    </Group>
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

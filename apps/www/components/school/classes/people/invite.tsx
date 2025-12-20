"use client";

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
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { useQuery } from "convex/react";
import {
  CheckIcon,
  CopyIcon,
  GraduationCapIcon,
  SpeechIcon,
  UserPlusIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useClass } from "@/lib/context/use-class";

export function SchoolClassesPeopleInvite() {
  const t = useTranslations("School.Classes");

  const classId = useClass((state) => state.class._id);

  const [openInviteDialog, setOpenInviteDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>("student");

  const clipboard = useClipboard({ timeout: 500 });

  const inviteCodes = useQuery(api.classes.queries.getInviteCodes, {
    classId,
  });

  // Create map of invite codes by role for O(1) lookup with type safety
  const inviteCodesByRole = useMemo(() => {
    if (!inviteCodes) {
      return new Map<Role, NonNullable<typeof inviteCodes>[number]>();
    }
    return new Map(inviteCodes.map((c) => [c.role, c] as const));
  }, [inviteCodes]);

  const code = useMemo(
    () => inviteCodesByRole.get(selectedRole)?.code ?? "",
    [inviteCodesByRole, selectedRole]
  );

  return (
    <ButtonGroup>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>
            <UserPlusIcon />
            {t("invite")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t("role")}</DropdownMenuLabel>
          <DropdownMenuGroup>
            {roles.map((role) => (
              <DropdownMenuItem
                className="cursor-pointer"
                key={role.value}
                onSelect={() => {
                  setSelectedRole(role.value);
                  setOpenInviteDialog(true);
                }}
              >
                <role.icon />
                {t(role.value)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResponsiveDialog
        description={t(`invite-${selectedRole}-description`)}
        footer={
          <Button
            onClick={() => {
              if (code) {
                clipboard.copy(code);
                toast.success(t("invite-code-copied"), {
                  position: "bottom-center",
                });
              }
            }}
          >
            {clipboard.copied ? <CheckIcon /> : <CopyIcon />}
            {t("copy")}
          </Button>
        }
        open={openInviteDialog}
        setOpen={setOpenInviteDialog}
        title={t(`invite-${selectedRole}-title`)}
      >
        <div className="flex items-center justify-center rounded-md border px-4 py-8">
          <p className="font-medium text-3xl tracking-tighter">{code}</p>
        </div>
      </ResponsiveDialog>
    </ButtonGroup>
  );
}

const roles = [
  { value: "teacher", icon: SpeechIcon },
  { value: "student", icon: GraduationCapIcon },
] as const;
type Role = (typeof roles)[number]["value"];

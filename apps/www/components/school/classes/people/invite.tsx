"use client";

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
  CopyIcon,
  GraduationCapIcon,
  PlusIcon,
  SpeechIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useClass } from "@/lib/context/use-class";

export function SchoolClassesPeopleInvite() {
  const t = useTranslations("School.Classes");

  const classId = useClass((state) => state.class._id);

  const [openInviteDialog, setOpenInviteDialog] = useState(false);
  const [selectedRole, setSelectedRole] =
    useState<(typeof roles)[number]["value"]>("student");

  const inviteCodes = useQuery(api.classes.queries.getInviteCodes, {
    classId,
  });

  // Create map of invite codes by role for O(1) lookup with type safety
  const inviteCodesByRole = useMemo(() => {
    if (!inviteCodes) {
      return new Map<
        (typeof roles)[number]["value"],
        NonNullable<typeof inviteCodes>[number]
      >();
    }
    return new Map(inviteCodes.map((c) => [c.role, c] as const));
  }, [inviteCodes]);

  const code = useMemo(
    () => inviteCodesByRole.get(selectedRole)?.code ?? "",
    [inviteCodesByRole, selectedRole]
  );

  return (
    <ButtonGroup className="divide-x divide-border/20">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>
            <PlusIcon />
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
                navigator.clipboard.writeText(code);
                toast.success(t("invite-code-copied"), {
                  position: "bottom-center",
                });
              }
            }}
          >
            <CopyIcon />
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

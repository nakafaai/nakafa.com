"use client";

import { PartyIcon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import {
  type SelfSelectableUserRole,
  userRoles,
} from "@repo/backend/convex/users/roles";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useMutation } from "convex/react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type { CurrentUser } from "@/lib/context/use-user";
import { useUser } from "@/lib/context/use-user";
import { roles } from "@/lib/data/roles";

type Role = SelfSelectableUserRole;

export function Onboarding() {
  const user = useUser((state) => state.user);

  if (!user) {
    return null;
  }

  return <OnboardingContent user={user} />;
}

/** Renders the first-run role picker and persists the selected user role. */
function OnboardingContent({ user }: { user: CurrentUser }) {
  const t = useTranslations("Onboarding");
  const roleItems = roles.map((role) => ({
    label: (
      <>
        <HugeIcons icon={role.icon} />
        {t(role.value)}
      </>
    ),
    value: role.value,
  }));

  const [selectedRole, setSelectedRole] = useState<Role | undefined>(undefined);

  const updateUserRole = useMutation(api.users.mutations.updateUserRole);

  const [isPending, startTransition] = useTransition();

  const handleRoleChange = (value: Role | null) => {
    if (!value) {
      return;
    }

    setSelectedRole(value);
  };

  const handleStartLearning = () => {
    if (!selectedRole) {
      return;
    }

    startTransition(async () => {
      await updateUserRole({
        role: selectedRole,
      });
    });
  };

  const open = !userRoles.some((role) => role === user.appUser.role);

  return (
    <Dialog open={open}>
      <DialogContent className="p-0" showCloseButton={false}>
        <div className="p-2">
          <Image
            alt="Nakafa"
            className="w-full rounded-md"
            fetchPriority="high"
            height={216}
            loading="eager"
            src="/og.png"
            title="Nakafa"
            width={382}
          />
        </div>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <DialogPanel scrollFade={false}>
          <Select
            disabled={isPending}
            items={roleItems}
            onValueChange={handleRoleChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("select-role")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {roles.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    <HugeIcons icon={role.icon} />
                    {t(role.value)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </DialogPanel>

        <DialogFooter>
          <Button
            disabled={!selectedRole || isPending}
            onClick={handleStartLearning}
          >
            <Spinner icon={PartyIcon} isLoading={isPending} />
            {t("button")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

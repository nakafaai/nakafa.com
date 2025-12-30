"use client";

import { PartyIcon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import type { AppUser } from "@repo/backend/convex/auth";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
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
import { useMutation, useQuery } from "convex/react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { roles } from "@/lib/data/roles";

type Role = (typeof roles)[number]["value"];

export function Onboarding() {
  const user = useQuery(api.auth.getCurrentUser);

  if (!user) {
    return null;
  }

  return <OnboardingContent user={user} />;
}

function OnboardingContent({ user }: { user: AppUser }) {
  const t = useTranslations("Onboarding");

  const [selectedRole, setSelectedRole] = useState<Role | undefined>(undefined);

  const updateUserRole = useMutation(api.users.mutations.updateUserRole);

  const [isPending, startTransition] = useTransition();

  const handleRoleChange = (value: Role) => {
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

  // Dialog stays open until user has a role
  const open = !user.appUser.role;

  return (
    <Dialog open={open}>
      <DialogContent className="gap-0 p-0" showCloseButton={false}>
        <div className="p-2">
          <Image
            alt="Nakafa"
            className="w-full rounded-md"
            fetchPriority="high"
            height={216}
            loading="eager"
            preload
            src="/og.png"
            title="Nakafa"
            width={382}
          />
        </div>
        <div className="space-y-6 px-6 pt-3 pb-6">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <Select disabled={isPending} onValueChange={handleRoleChange}>
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

          <DialogFooter>
            <Button
              disabled={!selectedRole || isPending}
              onClick={handleStartLearning}
            >
              <Spinner icon={PartyIcon} isLoading={isPending} />
              {t("button")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

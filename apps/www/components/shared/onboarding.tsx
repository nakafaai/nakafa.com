"use client";

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
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { useMutation, useQuery } from "convex/react";
import { PartyPopperIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { roles } from "@/lib/data/roles";

export function Onboarding() {
  const user = useQuery(api.auth.getCurrentUser);

  if (!user) {
    return null;
  }

  return <OnboardingContent user={user} />;
}

function OnboardingContent({ user }: { user: AppUser }) {
  const t = useTranslations("Onboarding");

  // Capture initial state - if user had no role when component mounted
  const [initiallyHadNoRole] = useState(!user.appUser.role);
  const [hasClickedStart, setHasClickedStart] = useState(false);

  const updateUserRole = useMutation(api.users.mutations.updateUserRole);

  const [isPending, startTransition] = useTransition();

  const handleUpdateUserRole = (role: (typeof roles)[number]["value"]) => {
    startTransition(async () => {
      await updateUserRole({
        role,
      });
    });
  };

  // Dialog stays open until user clicks the start button
  const open = initiallyHadNoRole && !hasClickedStart;

  return (
    <Dialog open={open}>
      <DialogContent className="gap-0 p-0" showCloseButton={false}>
        <div className="p-2">
          <Image
            alt="Nakafa"
            className="w-full rounded-md"
            height={630}
            src="/og.png"
            title="Nakafa"
            width={1200}
          />
        </div>
        <div className="space-y-6 px-6 pt-3 pb-6">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <Select
            defaultValue={user.appUser.role ?? undefined}
            onValueChange={handleUpdateUserRole}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("select-role")} />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem
                  disabled={isPending}
                  key={role.value}
                  value={role.value}
                >
                  <role.icon />
                  {t(role.value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() => setHasClickedStart(true)}
            >
              {isPending ? <SpinnerIcon /> : <PartyPopperIcon />}
              {t("button")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import type { PaginatedQueryItem } from "@confect/react";
import { useMutation } from "@confect/react";
import {
  ArrowDown01Icon,
  CommandLineIcon,
  UnavailableIcon,
} from "@hugeicons/core-free-icons";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { toast } from "@repo/design-system/lib/toast/notify";
import { useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";

/** One integration client as the school's list shows it. */
type ClientItem = PaginatedQueryItem<typeof integrations.clients.list>;

/**
 * Connects a device to one client (RFC 8628, ADR 0029): the Admin types the code the
 * Nakafa CLI shows, and authorizes the device, which then reads as this client, or denies
 * it. Revoking or rotating the client ends the device's access.
 */
export function SchoolDeviceDialog({
  client,
  open,
  setOpen,
  slug,
}: {
  client: ClientItem;
  open: boolean;
  setOpen: (open: boolean) => void;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const id = useId();
  const authorize = useMutation(integrations.devices.authorize);
  const deny = useMutation(integrations.devices.deny);
  const [isPending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const isComplete = code.trim().length > 0;

  const close = () => setOpen(false);

  return (
    <ResponsiveDialog
      action={
        <ButtonGroup aria-label={t("device-title")}>
          <Button
            disabled={!isComplete || isPending}
            inert={isPending}
            onClick={() =>
              startTransition(() =>
                runSchoolWrite(
                  schoolCall(() =>
                    authorize({ clientId: client.id, slug, userCode: code })
                  ),
                  {
                    onSaved: () => {
                      close();
                      toast.success({
                        title: "school-device-authorized.title",
                      });
                    },
                  }
                )
              )
            }
            type="button"
          >
            <HugeIcons icon={CommandLineIcon} />
            {common("connect")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={!isComplete || isPending}
              render={
                <Button
                  size="icon"
                  tooltip={common("more-actions")}
                  type="button"
                />
              }
            >
              <HugeIcons aria-hidden="true" icon={ArrowDown01Icon} />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48"
              label={common("menu-actions")}
            >
              <DropdownMenuItem
                icon={UnavailableIcon}
                onClick={() =>
                  startTransition(() =>
                    runSchoolWrite(
                      schoolCall(() => deny({ slug, userCode: code })),
                      {
                        onSaved: () => {
                          close();
                          toast.success({
                            title: "school-device-denied.title",
                          });
                        },
                      }
                    )
                  )
                }
                variant="destructive"
              >
                {t("device-deny")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      }
      description={t("device-description", { name: client.name })}
      // The typed code is forgotten once the dialog has closed, so the closing dialog keeps it.
      onOpenChangeComplete={(next) => {
        if (!next) {
          setCode("");
        }
      }}
      open={open}
      setOpen={setOpen}
      title={t("device-title")}
    >
      <Field>
        <FieldLabel htmlFor={`${id}-code`}>{t("device-code")}</FieldLabel>
        <Input
          autoCapitalize="characters"
          autoComplete="off"
          id={`${id}-code`}
          onChange={(event) => setCode(event.target.value)}
          placeholder="BCDF-GHJK"
          value={code}
        />
      </Field>
    </ResponsiveDialog>
  );
}

import { useMutation } from "@confect/react";
import guardians from "@repo/backend/confect/_generated/refs/guardians";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Option, Schema, String as Str } from "effect";
import { useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import {
  type LinkItem,
  readdressLinkChange,
} from "@/components/tenant/guardian/change";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/guardian/address";

/**
 * The dialog that corrects the parent email of a pending link. It starts from the link's address and keeps only what
 * Staff types, and Save waits for a valid address that differs. The link keeps its term, and the parent asks for a
 * code with the new address. It opens as it mounts and stays mounted while it closes, so its body never empties; its
 * caller mounts it again for each opening.
 */
export function GuardianLinkAddressDialog({ link }: { link: LinkItem }) {
  const t = useTranslations("SchoolGuardians");
  const common = useTranslations("Common");
  const { slug } = useTenant();
  const id = useId();
  const readdress = useMutation(guardians.links.readdress).withOptimisticUpdate(
    readdressLinkChange
  );
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(true);
  const [edited, setEdited] = useState<string | null>(null);
  const email = edited ?? link.email;
  const address = Option.filter(
    Schema.decodeOption(Email)(Str.toLowerCase(Str.trim(email))),
    (next) => next !== link.email
  );

  const save = () => {
    if (Option.isNone(address)) {
      return;
    }
    setOpen(false);
    startTransition(() =>
      saveSchool(
        () => readdress({ email: address.value, linkId: link.id, slug }),
        SOURCE
      )
    );
  };

  return (
    <ResponsiveDialog
      description={t("link-readdress-description")}
      footer={
        <>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {common("cancel")}
          </Button>
          <Button
            disabled={Option.isNone(address)}
            onClick={save}
            type="button"
          >
            {t("link-readdress-save")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("link-readdress")}
    >
      <Field>
        <FieldLabel htmlFor={`${id}-email`}>{t("email-label")}</FieldLabel>
        <Input
          autoComplete="off"
          id={`${id}-email`}
          inputMode="email"
          onChange={(event) => setEdited(event.target.value)}
          placeholder={t("email-placeholder")}
          type="email"
          value={email}
        />
        <FieldDescription>{t("email-description")}</FieldDescription>
      </Field>
    </ResponsiveDialog>
  );
}

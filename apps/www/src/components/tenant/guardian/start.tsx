import { useMutation } from "@confect/react";
import { Link01Icon } from "@hugeicons/core-free-icons";
import guardians from "@repo/backend/confect/_generated/refs/guardians";
import { Email, PersonName } from "@repo/backend/confect/tenancy/schema";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Option, Schema, String as Str } from "effect";
import { useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { startLinkChange } from "@/components/tenant/guardian/change";
import {
  type PersonId,
  SchoolStudentPicker,
} from "@/components/tenant/settings/people";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/guardian/start";

/**
 * The dialog that links a guardian to a student: the student, the guardian's name, and the
 * address that will receive the sign-in code. Nothing is mailed now: the guardian asks for a
 * code on the school's parent page. The dialog closes as the link is sent.
 */
export function GuardianLinkStartDialog({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("SchoolGuardians");
  const common = useTranslations("Common");
  const { slug } = useTenant();
  const id = useId();
  const start = useMutation(guardians.links.start).withOptimisticUpdate(
    startLinkChange
  );
  const [isPending, startTransition] = useTransition();
  const [studentId, setStudentId] = useState<PersonId | undefined>(undefined);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const guardianName = Schema.decodeOption(PersonName)(Str.trim(name));
  const address = Schema.decodeOption(Email)(Str.toLowerCase(Str.trim(email)));
  const ready =
    studentId !== undefined &&
    Option.isSome(guardianName) &&
    Option.isSome(address);

  const submit = () => {
    if (
      studentId === undefined ||
      Option.isNone(guardianName) ||
      Option.isNone(address)
    ) {
      return;
    }
    setOpen(false);
    startTransition(() =>
      saveSchool(
        () =>
          start({
            email: address.value,
            guardianName: guardianName.value,
            slug,
            studentId,
          }),
        SOURCE,
        () => {
          setStudentId(undefined);
          setName("");
          setEmail("");
        }
      )
    );
  };

  return (
    <ResponsiveDialog
      description={t("link-add-description")}
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
            disabled={!ready || isPending}
            inert={isPending}
            onClick={submit}
            type="button"
          >
            <HugeIcons icon={Link01Icon} />
            {t("link-add")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("link-add")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-student`}>{t("student")}</FieldLabel>
          <SchoolStudentPicker
            id={`${id}-student`}
            onChoose={setStudentId}
            personId={studentId}
            slug={slug}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-name`}>{t("guardian-name")}</FieldLabel>
          <Input
            id={`${id}-name`}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-email`}>{t("email-label")}</FieldLabel>
          <Input
            autoComplete="off"
            id={`${id}-email`}
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}

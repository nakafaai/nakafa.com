import { useMutation } from "@confect/react";
import operators from "@repo/backend/confect/_generated/refs/operators";
import { TenantKind, UnitLevel } from "@repo/backend/confect/tenancy/schema";
import { StartCountry } from "@repo/backend/confect/tenancy/start";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, Option } from "effect";
import { type ComponentProps, useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import {
  EMPTY_OPEN_FORM,
  type OpenForm,
  openRequest,
} from "@/components/operators/state";
import { saveSchool } from "@/components/tenant/settings/save";
import { suggestSlug, typedSlug } from "@/components/tenant/start/state";

const SOURCE = "components/operators/open";

/** A field of the form that holds one line of text. */
type TextField = keyof Pick<
  typeof OpenForm.Type,
  "contentLicense" | "dpaVersion" | "email" | "owner"
>;

/** One labelled line of text of the form. */
function OpenTextField({
  field,
  form,
  label,
  onChange,
  placeholder,
  type,
}: {
  field: TextField;
  form: typeof OpenForm.Type;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: ComponentProps<typeof Input>["type"];
}) {
  const id = useId();

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={form[field]}
      />
    </Field>
  );
}

/** One labelled choice of the form, among `items`. */
function OpenSelectField<const Value extends string>({
  items,
  label,
  onChange,
  value,
}: {
  items: readonly { readonly label: string; readonly value: Value }[];
  label: string;
  onChange: (value: Value) => void;
  value: Value;
}) {
  const id = useId();

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        items={items}
        onValueChange={(next) =>
          Option.map(
            Arr.findFirst(items, (item) => item.value === next),
            (item) => onChange(item.value)
          )
        }
        value={value}
      >
        <SelectTrigger className="w-full" id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {Arr.map(items, (item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

/**
 * The contract sheet that opens a school (K9): the school, its first Owner, who gets the
 * invite, and the plan and versions the school signed. The button stays as it is while the
 * request runs. A refused opening stays open with its reason, and an opened school joins the
 * list behind the dialog as the server writes it.
 */
export function OpenSchoolDialog({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("Operators");
  const tStart = useTranslations("SchoolStart");
  const common = useTranslations("Common");
  const openSchool = useMutation(operators.tenants.open);
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState(EMPTY_OPEN_FORM);
  const request = openRequest(form);

  const set = (change: Partial<typeof OpenForm.Type>) =>
    setForm((current) => ({ ...current, ...change }));

  const submit = () => {
    if (Option.isNone(request)) {
      return;
    }
    startTransition(() =>
      saveSchool(
        () => openSchool(request.value),
        SOURCE,
        () => {
          setOpen(false);
          setForm(EMPTY_OPEN_FORM);
        }
      )
    );
  };

  return (
    <ResponsiveDialog
      description={t("open-description")}
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
            disabled={Option.isNone(request)}
            inert={isPending}
            onClick={submit}
            type="button"
          >
            {t("open")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("open")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-name`}>{t("name")}</FieldLabel>
          <Input
            id={`${id}-name`}
            onChange={(event) =>
              set({
                name: event.target.value,
                slug: suggestSlug(event.target.value),
              })
            }
            placeholder={t("name-placeholder")}
            value={form.name}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-slug`}>{t("address")}</FieldLabel>
          <Input
            id={`${id}-slug`}
            onChange={(event) => set({ slug: typedSlug(event.target.value) })}
            placeholder={t("address-placeholder")}
            value={form.slug}
          />
        </Field>
        <OpenSelectField
          items={Arr.map(TenantKind.literals, (value) => ({
            label: t(`kind.${value}`),
            value,
          }))}
          label={t("kind-label")}
          onChange={(kind) => set({ kind })}
          value={form.kind}
        />
        <OpenSelectField
          items={Arr.map(StartCountry.literals, (value) => ({
            label: tStart(`country.${value}`),
            value,
          }))}
          label={t("country")}
          onChange={(country) => set({ country })}
          value={form.country}
        />
        <OpenSelectField
          items={Arr.map(UnitLevel.literals, (value) => ({
            label: tStart(`level.${value}.title`),
            value,
          }))}
          label={t("level")}
          onChange={(level) => set({ level })}
          value={form.level}
        />
        <OpenTextField
          field="owner"
          form={form}
          label={t("owner")}
          onChange={(owner) => set({ owner })}
          placeholder={t("owner-placeholder")}
        />
        <OpenTextField
          field="email"
          form={form}
          label={t("email")}
          onChange={(email) => set({ email })}
          placeholder={t("email-placeholder")}
          type="email"
        />
        <OpenSelectField
          items={[
            { label: t("plan.tenant"), value: "tenant" },
            { label: t("plan.unit"), value: "unit" },
          ]}
          label={t("plan-label")}
          onChange={(plan) => set({ plan })}
          value={form.plan}
        />
        <OpenTextField
          field="dpaVersion"
          form={form}
          label={t("dpa")}
          onChange={(dpaVersion) => set({ dpaVersion })}
          placeholder={t("version-placeholder")}
        />
        <OpenTextField
          field="contentLicense"
          form={form}
          label={t("license")}
          onChange={(contentLicense) => set({ contentLicense })}
          placeholder={t("version-placeholder")}
        />
      </FieldGroup>
    </ResponsiveDialog>
  );
}

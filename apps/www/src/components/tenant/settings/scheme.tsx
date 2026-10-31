import { useMutation } from "@confect/react";
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import records from "@repo/backend/confect/_generated/refs/records";
import { DEFAULT_GRADING_SCHEME } from "@repo/backend/confect/records/scheme";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@repo/design-system/components/ui/number";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { randomUuid } from "@repo/utilities/uuid";
import { Array as Arr, DateTime, Effect, Option } from "effect";
import { startTransition, use, useId, useState } from "react";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeaderAdd } from "@/components/tenant/header";
import { saveSchool } from "@/components/tenant/settings/save";
import {
  amendSchemeChange,
  checkedScheme,
  draftOfScheme,
  nextEffectiveFrom,
  type SchemeDraft,
  type SchemeVersion,
  SchemeVersionsContext,
  storeSchemeChange,
} from "@/components/tenant/settings/versions";

const SOURCE = "components/tenant/settings/scheme";

/**
 * The grading page's one action, New version, and the dialog it opens. The button is ready from the first paint, and
 * the dialog fills in with the version in force, or the built-in scheme before the first, once the versions are read.
 * Each opening is a dialog of its own, so its fields start from the version in force then.
 */
export function SchemeVersionAdd() {
  const t = useTranslations("SchoolSettings");
  const [openings, setOpenings] = useState(0);

  return (
    <>
      <SchoolHeaderAdd
        label={t("grading-new")}
        onClick={() => setOpenings((count) => count + 1)}
      />
      {openings === 0 ? null : (
        <SchemeVersionDialog editing={Option.none()} key={openings} />
      )}
    </>
  );
}

/**
 * The dialog of a new version: its KKTP and its bands, each band a label and the value it starts from, which the
 * Admin adds and removes. While the versions are read its fields wait, so they fill in with the version in force
 * before the Admin types. Save waits for a scheme the server accepts, and the version shows first at once, dated now
 * or just after the newest version.
 */
export function SchemeVersionDialog({
  editing,
}: {
  /** The version the dialog corrects, or none when it writes a new one. */
  editing: Option.Option<SchemeVersion>;
}) {
  const t = useTranslations("SchoolSettings");
  const { newest, ready } = use(SchemeVersionsContext);
  const common = useTranslations("Common");
  const { slug } = useTenant();
  const id = useId();
  const store = useMutation(records.schemes.store).withOptimisticUpdate(
    storeSchemeChange
  );
  const amend = useMutation(records.schemes.amend).withOptimisticUpdate(
    amendSchemeChange
  );
  const [open, setOpen] = useState(true);
  // The form holds only what the Admin changed, and shows the version in force until then.
  const [edited, setDraft] = useState<typeof SchemeDraft.Type | null>(null);
  const draft =
    edited ??
    draftOfScheme(
      Option.getOrElse(
        Option.orElse(editing, () => newest),
        () => DEFAULT_GRADING_SCHEME
      )
    );
  const checked = checkedScheme(draft);

  const save = () => {
    if (Option.isNone(checked)) {
      return;
    }
    setOpen(false);
    const now = DateTime.toEpochMillis(Effect.runSync(DateTime.now));
    startTransition(() =>
      saveSchool(
        () =>
          Option.match(editing, {
            onNone: () =>
              store({
                ...checked.value,
                effectiveFrom: nextEffectiveFrom(now, newest),
                slug,
              }),
            onSome: (version) =>
              amend({ ...checked.value, schemeId: version.id, slug }),
          }),
        SOURCE
      )
    );
  };

  const addBand = () =>
    setDraft({
      ...draft,
      bands: Arr.append(draft.bands, {
        key: Effect.runSync(randomUuid),
        label: "",
        minimum: null,
      }),
    });

  return (
    <ResponsiveDialog
      description={t(
        Option.isSome(editing)
          ? "grading-edit-description"
          : "grading-new-description"
      )}
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
            disabled={!ready || Option.isNone(checked)}
            onClick={save}
            type="button"
          >
            {t("grading-save")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t(Option.isSome(editing) ? "grading-edit" : "grading-new")}
    >
      <FieldSet disabled={!ready}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-kktp`}>{t("grading-kktp")}</FieldLabel>
            <NumberField
              id={`${id}-kktp`}
              max={100}
              min={0}
              onValueChange={(kktp) => setDraft({ ...draft, kktp })}
              value={draft.kktp}
            >
              <NumberFieldGroup>
                <NumberFieldDecrement />
                <NumberFieldInput />
                <NumberFieldIncrement />
              </NumberFieldGroup>
            </NumberField>
          </Field>
          {Arr.map(draft.bands, (band) => (
            <div className="flex items-end gap-3" key={band.key}>
              <Field className="min-w-0 flex-1">
                <FieldLabel htmlFor={`${id}-${band.key}-label`}>
                  {t("grading-band-label")}
                </FieldLabel>
                <Input
                  id={`${id}-${band.key}-label`}
                  maxLength={40}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      bands: Arr.map(draft.bands, (row) =>
                        row.key === band.key
                          ? { ...row, label: event.target.value }
                          : row
                      ),
                    })
                  }
                  placeholder={t("grading-band-label-placeholder")}
                  value={band.label}
                />
              </Field>
              <Field className="w-36 shrink-0">
                <FieldLabel htmlFor={`${id}-${band.key}-minimum`}>
                  {t("grading-band-minimum")}
                </FieldLabel>
                <NumberField
                  id={`${id}-${band.key}-minimum`}
                  max={100}
                  min={0}
                  onValueChange={(minimum) =>
                    setDraft({
                      ...draft,
                      bands: Arr.map(draft.bands, (row) =>
                        row.key === band.key ? { ...row, minimum } : row
                      ),
                    })
                  }
                  value={band.minimum}
                >
                  <NumberFieldGroup>
                    <NumberFieldInput />
                  </NumberFieldGroup>
                </NumberField>
              </Field>
              <Button
                aria-label={t("grading-band-remove")}
                onClick={() =>
                  setDraft({
                    ...draft,
                    bands: Arr.filter(
                      draft.bands,
                      (row) => row.key !== band.key
                    ),
                  })
                }
                size="icon"
                type="button"
                variant="ghost"
              >
                <HugeIcons icon={Delete02Icon} />
              </Button>
            </div>
          ))}
          <div>
            <Button onClick={addBand} type="button" variant="outline">
              <HugeIcons icon={Add01Icon} />
              {t("grading-band-add")}
            </Button>
          </div>
        </FieldGroup>
      </FieldSet>
    </ResponsiveDialog>
  );
}

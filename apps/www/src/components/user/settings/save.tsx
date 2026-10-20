import { Button } from "@repo/design-system/components/ui/button";
import { type AnyFormApi, useStore } from "@tanstack/react-form";
import { useTranslations } from "use-intl";
import {
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";

/** The Save action of a settings card, which submits its form. */
export function SettingsSave({ disabled }: { disabled: boolean }) {
  const t = useTranslations("Auth");

  return (
    <CardSectionActions>
      <Button disabled={disabled} size="sm" type="submit">
        {t("save")}
      </Button>
    </CardSectionActions>
  );
}

/**
 * The footer of a settings card with one form: its hint, and Save, which turns
 * on once the form holds a valid change.
 */
export function SettingsFormFooter({
  form,
  hint,
}: {
  form: AnyFormApi;
  hint: string;
}) {
  const canSave = useStore(
    form.store,
    (state) => state.isDirty && state.isValid
  );

  return (
    <CardSectionFooter hint={hint}>
      <SettingsSave disabled={!canSave} />
    </CardSectionFooter>
  );
}

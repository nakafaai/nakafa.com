import { AtomShellLab } from "@repo/design-system/components/contents/chemistry/atom-shell/lab";
import { useTranslations } from "use-intl";
import { getAtomLabels } from "@/components/marketing/about/lesson/labels";
import { useLessonSelection } from "@/components/marketing/about/lesson/selection";

/** The atom lesson's lab: the shells of a neutral atom, one sample at a time. */
export function AtomLesson() {
  const t = useTranslations("Landing");
  const defaultSampleId = useLessonSelection((state) => state.atomSample);
  const onSampleIdChange = useLessonSelection((state) => state.setAtomSample);

  return (
    <AtomShellLab
      defaultSampleId={defaultSampleId ?? undefined}
      labels={getAtomLabels(t)}
      onSampleIdChange={onSampleIdChange}
    />
  );
}

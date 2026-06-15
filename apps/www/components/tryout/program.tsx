import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@repo/design-system/components/ui/alert";
import { Badge } from "@repo/design-system/components/ui/badge";
import { getTranslations } from "next-intl/server";
import type { ActiveLearningProfile } from "@/components/programs/contract";

type TryoutLearningProfile = NonNullable<ActiveLearningProfile>;

/** Shows how the user's active learning program relates to try-out discovery. */
export async function TryoutLearningProgramContext({
  profile,
}: {
  profile: TryoutLearningProfile;
}) {
  const t = await getTranslations("LearningPrograms");
  const interestLabels = profile.interests
    .map((interest) => t(`interest.${interest}.title`))
    .join(", ");

  return (
    <Alert>
      <AlertTitle className="flex flex-wrap items-center gap-2">
        {t("tryout-context-title")}
        <Badge variant="outline">{profile.program.title}</Badge>
      </AlertTitle>
      <AlertDescription>
        {t("tryout-context-description", {
          interests: interestLabels,
          program: profile.program.title,
        })}
      </AlertDescription>
    </Alert>
  );
}

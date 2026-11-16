import { Alert02Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@repo/design-system/components/ui/alert";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";

export const card = {
  name: "Alert",
  group: "Feedback",
  height: 210,
  source: "alert",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex max-w-lg flex-col gap-3 p-6">
      <Alert>
        <HugeIcons icon={InformationCircleIcon} />
        <AlertTitle>Tryout opens on Monday</AlertTitle>
        <AlertDescription>
          Registration closes on Sunday at 23:59 WIB.
        </AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <HugeIcons icon={Alert02Icon} />
        <AlertTitle>Your answers were not saved</AlertTitle>
        <AlertDescription>
          Check your connection and submit again.
        </AlertDescription>
      </Alert>
    </div>
  );
}

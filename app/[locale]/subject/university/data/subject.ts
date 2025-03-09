import { BrainCircuitIcon, Gamepad2Icon } from "lucide-react";

const BASE_PATH = "/subject/university";

function getSubjects(label: "bachelor" | "master") {
  return [
    {
      icon: BrainCircuitIcon,
      label: "ai-ds",
      href: `${BASE_PATH}/${label}/ai-ds`,
    },
    {
      icon: Gamepad2Icon,
      label: "game-engineering",
      href: `${BASE_PATH}/${label}/game-engineering`,
    },
  ] as const;
}

export const bachelorSubjects = getSubjects("bachelor");

"use client";

import { useState } from "react";
import { TryoutChoiceSurface } from "@/components/tryout/runtime/choice";

interface FeatureChoice {
  label: string;
  value: boolean;
}

interface FeaturesTryoutChoicesProps {
  choices: readonly FeatureChoice[];
}

/** Adds local interaction to the same choice surface used by Tryout. */
export function FeaturesTryoutChoices({ choices }: FeaturesTryoutChoicesProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {choices.map((choice, index) => (
        <TryoutChoiceSurface
          checked={selectedIndex === index}
          disabled={false}
          id={`features-tryout-choice-${index}`}
          isCorrect={choice.value}
          key={choice.label}
          label={choice.label}
          onSelect={() => setSelectedIndex(index)}
          reviewMode={selectedIndex !== null}
        />
      ))}
    </div>
  );
}

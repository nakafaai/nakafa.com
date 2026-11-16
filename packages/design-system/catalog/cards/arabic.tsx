import { ArabicKeypad } from "@repo/design-system/components/ui/arabic";
import { useState } from "react";

/** The keypad with the words it has typed, as a player shows it beside an answer. */
function Keypad() {
  const [typed, setTyped] = useState("كَتَابٌ");

  return (
    <div className="flex w-fit flex-col gap-3 p-6">
      <p
        className="font-quran min-h-8 rounded-md border px-3 py-1 text-xl"
        dir="rtl"
        lang="ar"
      >
        {typed}
      </p>
      <ArabicKeypad onKey={(text) => setTyped((current) => current + text)} />
    </div>
  );
}

export const card = {
  name: "ArabicKeypad",
  group: "Forms",
  height: 350,
  source: "arabic",
};

/** The card's live example. */
export function Preview() {
  return <Keypad />;
}

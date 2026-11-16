import { SearchField } from "@repo/design-system/components/ui/search";
import { useState } from "react";

/** A table's search box: the clear button shows once the box holds text. */
function Search() {
  const [empty, setEmpty] = useState("");
  const [filled, setFilled] = useState("Aisyah");

  return (
    <div className="flex max-w-sm flex-col gap-3 p-6">
      <SearchField
        onValueChange={setEmpty}
        placeholder="Find a student"
        value={empty}
      />
      <SearchField
        onValueChange={setFilled}
        placeholder="Find a student"
        value={filled}
      />
    </div>
  );
}

export const card = {
  name: "SearchField",
  group: "Forms",
  height: 150,
  source: "search",
};

/** The card's live example. */
export function Preview() {
  return <Search />;
}

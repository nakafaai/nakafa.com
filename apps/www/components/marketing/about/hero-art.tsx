"use client";

import { BlockArt } from "@repo/design-system/components/ui/block-art";
import { themes } from "@repo/design-system/lib/theme";
import { useTheme } from "next-themes";

export function HeroArt() {
  const { theme: currentTheme, setTheme } = useTheme();

  function handleCellClick() {
    // randomize the theme, make sure it's not the current theme
    const randomTheme = themes.filter((theme) => theme.value !== currentTheme)[
      Math.floor(Math.random() * themes.length)
    ];
    if (randomTheme) {
      setTheme(randomTheme.value);
    }
  }

  return <BlockArt onCellClick={handleCellClick} />;
}

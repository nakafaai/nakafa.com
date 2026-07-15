import {
  AlphabetJapaneseIcon,
  AsteriskIcon,
  BlackHoleIcon,
  CloudIcon,
  CottonCandyIcon,
  CpuIcon,
  DrinkIcon,
  FastWindIcon,
  FlowerIcon,
  GameIcon,
  GemIcon,
  HappyIcon,
  HourglassIcon,
  InLoveIcon,
  KnightShieldIcon,
  LaptopIcon,
  MoonEclipseIcon,
  MoonIcon,
  NotebookIcon,
  OrangeIcon,
  PineTreeIcon,
  RadioIcon,
  RecordIcon,
  ShellfishIcon,
  SnailIcon,
  SnowIcon,
  StarIcon,
  Sun01Icon,
  SunsetIcon,
  TeaIcon,
  TwitterIcon,
  YenIcon,
} from "@hugeicons/core-free-icons";
import { themes } from "@repo/design-system/lib/theme/registry";

type ThemeIconRegistry = {
  readonly [Value in (typeof themes)[number]["value"]]: typeof Sun01Icon;
};

const themeIcons = {
  light: Sun01Icon,
  dark: MoonIcon,
  system: LaptopIcon,
  darkmatter: BlackHoleIcon,
  bean: SnailIcon,
  bubblegum: CottonCandyIcon,
  caffeine: TeaIcon,
  claude: AsteriskIcon,
  cosmic: StarIcon,
  cute: HappyIcon,
  dreamy: CloudIcon,
  ghibli: AlphabetJapaneseIcon,
  luxury: GemIcon,
  matcha: DrinkIcon,
  nature: PineTreeIcon,
  neo: CpuIcon,
  notebook: NotebookIcon,
  pacman: GameIcon,
  perpetuity: HourglassIcon,
  pinky: InLoveIcon,
  popsicle: SnowIcon,
  retro: RadioIcon,
  shell: ShellfishIcon,
  solar: MoonEclipseIcon,
  sunset: SunsetIcon,
  tangerine: OrangeIcon,
  tokyo: YenIcon,
  tree: FlowerIcon,
  twitter: TwitterIcon,
  vintage: RecordIcon,
  windy: FastWindIcon,
  zelda: KnightShieldIcon,
} satisfies ThemeIconRegistry;

/** Theme picker options derived from the lightweight runtime registry. */
export const themeOptions = Object.freeze(
  themes.map((theme) => ({
    ...theme,
    icon: themeIcons[theme.value],
  }))
);

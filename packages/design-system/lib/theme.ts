import { IconBrandTwitter } from "@tabler/icons-react";
import {
  AsteriskIcon,
  BeanIcon,
  CandyIcon,
  CatIcon,
  CitrusIcon,
  CloudyIcon,
  CoffeeIcon,
  CpuIcon,
  CupSodaIcon,
  Disc3Icon,
  EclipseIcon,
  GemIcon,
  HeartIcon,
  HourglassIcon,
  JapaneseYenIcon,
  LaptopIcon,
  LeafIcon,
  MoonIcon,
  NotebookPenIcon,
  PandaIcon,
  PopsicleIcon,
  RabbitIcon,
  ShellIcon,
  SparkleIcon,
  SunIcon,
  SunsetIcon,
  SwordIcon,
  TreePineIcon,
  TvIcon,
  WindIcon,
} from "lucide-react";

export const themes = [
  {
    value: "light",
    icon: SunIcon,
  },
  {
    value: "dark",
    icon: MoonIcon,
  },
  {
    value: "system",
    icon: LaptopIcon,
  },
  // Custom
  {
    value: "bean",
    icon: BeanIcon,
  },
  {
    value: "bubblegum",
    icon: CandyIcon,
  },
  {
    value: "caffeine",
    icon: CoffeeIcon,
  },
  {
    value: "claude",
    icon: AsteriskIcon,
  },
  {
    value: "cosmic",
    icon: SparkleIcon,
  },
  {
    value: "cute",
    icon: RabbitIcon,
  },
  {
    value: "dreamy",
    icon: CloudyIcon,
  },
  {
    value: "ghibli",
    icon: CatIcon,
  },
  {
    value: "luxury",
    icon: GemIcon,
  },
  {
    value: "matcha",
    icon: CupSodaIcon,
  },
  {
    value: "nature",
    icon: LeafIcon,
  },
  {
    value: "neo",
    icon: CpuIcon,
  },
  {
    value: "notebook",
    icon: NotebookPenIcon,
  },
  {
    value: "pacman",
    icon: PandaIcon,
  },
  {
    value: "perpetuity",
    icon: HourglassIcon,
  },
  {
    value: "pinky",
    icon: HeartIcon,
  },
  {
    value: "popsicle",
    icon: PopsicleIcon,
  },
  {
    value: "retro",
    icon: TvIcon,
  },
  {
    value: "shell",
    icon: ShellIcon,
  },
  {
    value: "solar",
    icon: EclipseIcon,
  },
  {
    value: "sunset",
    icon: SunsetIcon,
  },
  {
    value: "tangerine",
    icon: CitrusIcon,
  },
  {
    value: "tokyo",
    icon: JapaneseYenIcon,
  },
  {
    value: "tree",
    icon: TreePineIcon,
  },
  {
    value: "twitter",
    icon: IconBrandTwitter,
  },
  {
    value: "vintage",
    icon: Disc3Icon,
  },
  {
    value: "windy",
    icon: WindIcon,
  },
  {
    value: "zelda",
    icon: SwordIcon,
  },
] as const;

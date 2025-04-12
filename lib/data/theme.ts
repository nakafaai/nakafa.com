import {
  AsteriskIcon,
  CatIcon,
  CitrusIcon,
  CloudyIcon,
  CoffeeIcon,
  CpuIcon,
  EclipseIcon,
  HeartIcon,
  HourglassIcon,
  LaptopIcon,
  LeafIcon,
  MoonIcon,
  SparkleIcon,
  SunIcon,
  SunsetIcon,
  TvIcon,
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
    value: "dreamy",
    icon: CloudyIcon,
  },
  {
    value: "solar",
    icon: EclipseIcon,
  },
  {
    value: "ghibli",
    icon: CatIcon,
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
    value: "perpetuity",
    icon: HourglassIcon,
  },
  {
    value: "pinky",
    icon: HeartIcon,
  },
  {
    value: "retro",
    icon: TvIcon,
  },
  {
    value: "sunset",
    icon: SunsetIcon,
  },
  {
    value: "tangerine",
    icon: CitrusIcon,
  },
] as const;

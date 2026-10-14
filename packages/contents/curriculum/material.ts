import {
  BankIcon,
  BinaryCodeIcon,
  CourtLawIcon,
  DnaIcon,
  ElectricWireIcon,
  GameIcon,
  GlobeIcon,
  HandshakeIcon,
  LaptopIcon,
  MapPinIcon,
  NeuralNetworkIcon,
  PhysicsIcon,
  PiIcon,
  ScrollIcon,
  SourceCodeIcon,
  TestTubeIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { SPARE_ICONS } from "@repo/contents/curriculum/spare";
import {
  isPresentedMaterialDomain,
  type PresentedMaterialDomain,
} from "@repo/contents/taxonomy";
import { Array as Arr } from "effect";

/** One Hugeicons drawing, as every icon of the product is stored. */
export type MaterialIcon = typeof PiIcon;

/**
 * The icon of each subject: the one that its card shows, and the first icon of
 * the family that its lessons draw from (see `getLessonIcons`). A subject's icon
 * is its own, so no other key of the product uses it.
 */
const materialIconByKey = {
  "ai-ds": NeuralNetworkIcon,
  biology: DnaIcon,
  chemistry: TestTubeIcon,
  "computer-science": BinaryCodeIcon,
  economy: BankIcon,
  "game-engineering": GameIcon,
  geography: GlobeIcon,
  geospatial: MapPinIcon,
  history: ScrollIcon,
  informatics: SourceCodeIcon,
  "informatics-engineering": LaptopIcon,
  "international-relations": HandshakeIcon,
  mathematics: PiIcon,
  physics: PhysicsIcon,
  "political-science": CourtLawIcon,
  sociology: UserGroupIcon,
  "technology-electro-medical": ElectricWireIcon,
} satisfies { readonly [Key in PresentedMaterialDomain]: MaterialIcon };

/**
 * Resolves the icons that a subject slug may show, the best first. A subject
 * the product knows has one: its own. A subject it does not know yet offers the
 * spare icons, so it never borrows the icon of another subject.
 *
 * @param material - Material slug to map to its icons
 * @returns Hugeicons icons for the material, never empty
 */
export function getMaterialIcons(material: string) {
  return isPresentedMaterialDomain(material)
    ? Arr.of(materialIconByKey[material])
    : SPARE_ICONS;
}

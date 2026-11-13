import { Nina } from "@repo/design-system/components/ui/nina";
import { PaperDemo } from "@/components/marketing/school/demo/paper";
import { SchoolFeatureText } from "@/components/marketing/school/features/text";
import {
  FeatureProduct,
  FeatureRow,
} from "@/components/marketing/shared/feature";

/**
 * The player part, as wide as the page under its words: the paper a student sits in the School's own player, one
 * question of every type a teacher writes, which a button group above it opens one at a time.
 */
export function SchoolPlayer() {
  return (
    <FeatureRow id="player" layout="wide">
      <SchoolFeatureText feature="player">
        <Nina act="writing" label="" size={88} whole />
      </SchoolFeatureText>
      <FeatureProduct>
        <PaperDemo />
      </FeatureProduct>
    </FeatureRow>
  );
}

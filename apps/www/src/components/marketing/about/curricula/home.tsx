import { Curricula } from "@/components/marketing/about/curricula";
import {
  CurriculumList,
  type CurriculumListProps,
} from "@/components/marketing/about/curricula/list";

/** The curricula part of the home page with its list. */
export function HomeCurricula({ curricula }: CurriculumListProps) {
  return (
    <Curricula>
      <CurriculumList curricula={curricula} />
    </Curricula>
  );
}

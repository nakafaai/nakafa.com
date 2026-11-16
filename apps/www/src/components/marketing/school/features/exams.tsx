import { Nina } from "@repo/design-system/components/ui/nina";
import { EditorDemo } from "@/components/marketing/school/demo/editor";
import { SchoolFeatureText } from "@/components/marketing/school/features/text";
import {
  FeatureProduct,
  FeatureRow,
} from "@/components/marketing/shared/feature";

/**
 * The exams part, as wide as the page: the School exam editor itself, one screen tall, over a demo exam that lives
 * in the page, so a visitor writes in it, sets its key and points, and moves between its pages as a teacher does.
 */
export function SchoolExams() {
  return (
    <FeatureRow id="exams" layout="wide">
      <SchoolFeatureText feature="exams">
        <Nina act="thinking" label="" size={88} whole />
      </SchoolFeatureText>
      <FeatureProduct>
        <EditorDemo />
      </FeatureProduct>
    </FeatureRow>
  );
}

import { Nina } from "@repo/design-system/components/ui/nina";
import { EditorDemo } from "@/components/marketing/school/editor/demo";
import { SchoolFeatureText } from "@/components/marketing/school/features/text";
import {
  FeatureProduct,
  FeatureRow,
} from "@/components/marketing/shared/feature";
<<<<<<< 8a0cce21a5287ea1a78e936343ec02b6c4a01d9b

/**
 * The exams part, as wide as the page: the School exam editor itself, one screen tall, over a demo exam that lives
 * in the page, so a visitor writes in it, sets its key and points, and moves between its pages as a teacher does.
=======
import { FigureMenuFrame } from "@/components/tenant/exams/figure/menu";
import { NoteField } from "@/components/tenant/exams/layer";
import { PaperOption, PaperOptions } from "@/components/tenant/exams/sheet";
import { pageThumb } from "@/components/tenant/exams/thumb";
import { useDocumentLabels } from "@/lib/editor/labels";

/** The pictures a demo exam holds: none, so the toolbar's picture menu opens on an empty exam. */
const NO_ADDRESSES: Readonly<Record<string, string>> = {};

/** The options of the demo question, by letter, each a momentum as the editor writes it. */
const OPTIONS = [
  { latex: "1.5\\ \\text{kg}\\cdot\\text{m/s}", letter: "A" },
  { latex: "5\\ \\text{kg}\\cdot\\text{m/s}", letter: "B" },
  { latex: "6\\ \\text{kg}\\cdot\\text{m/s}", letter: "C" },
  { latex: "9\\ \\text{kg}\\cdot\\text{m/s}", letter: "D" },
] as const;

/** The pages of the demo exam in the editor's strip, the third one open. */
const PAGES = Arr.makeBy(6, (index) => index + 1);

/** The editor's own toolbar over the exam, every control in its place, as a teacher meets it. */
function EditorToolbar() {
  const labels = useDocumentLabels();

  return (
    <PicturesProvider
      begin={Fn.constVoid}
      labels={labels.pictures}
      urls={NO_ADDRESSES}
    >
      <DocumentToolbar
        editor={null}
        extra={<FigureMenuFrame />}
        labels={labels.toolbar}
      />
    </PicturesProvider>
  );
}

/** The open question as the canvas draws it: its place and kind, its prompt with its formulas, and its options. */
function EditorQuestion() {
  const t = useTranslations("SchoolSite");
  const tExams = useTranslations("Exams");
  const tCommon = useTranslations("Common");

  return (
    <div className="grid min-w-0 content-start gap-6 p-4 sm:p-6">
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-medium">
          {tCommon("question", { number: 3 })}
        </span>
        <span className="text-muted-foreground">
          {tExams("template-choice")}
        </span>
      </p>
      <p className="text-pretty">
        {t.rich("demo-exam-question", {
          mass: () => <InlineMath math={"2\\ \\text{kg}"} />,
          speed: () => <InlineMath math={"3\\ \\text{m/s}"} />,
        })}
      </p>
      <PaperOptions dir="ltr">
        {Arr.map(OPTIONS, ({ latex, letter }) => (
          <PaperOption key={letter} letter={letter} multiple={false}>
            <span className="min-w-0 flex-1">
              <InlineMath math={latex} />
            </span>
          </PaperOption>
        ))}
      </PaperOptions>
    </div>
  );
}

/**
 * The teacher's layer of the open question, beside the canvas as the editor shows it: its points, its
 * answer key and its explanation. Each control takes the reader's changes, as it does in the editor.
 */
function TeacherLayer() {
  const t = useTranslations("SchoolSite");
  const tExams = useTranslations("Exams");
  const tCommon = useTranslations("Common");
  const pointsId = useId();
  const [points, setPoints] = useState<number | null>(4);
  const [key, setKey] = useState("C");

  return (
    <aside
      aria-label={tExams("teacher-layer")}
      className="bg-muted/50 grid content-start gap-6 p-4 sm:p-6"
    >
      <div className="grid gap-0.5">
        <h3 className="font-medium">{tExams("teacher-layer")}</h3>
        <p className="text-muted-foreground text-sm">
          {tCommon("question", { number: 3 })}
        </p>
      </div>
      <FieldGroup>
        <Field orientation="horizontal">
          <FieldLabel htmlFor={pointsId}>{tCommon("score-points")}</FieldLabel>
          <NumberField
            className="w-32"
            format={{ maximumFractionDigits: 0 }}
            id={pointsId}
            max={100}
            min={1}
            onValueChange={setPoints}
            step={1}
            value={points}
          >
            <NumberFieldGroup>
              <NumberFieldDecrement />
              <NumberFieldInput />
              <NumberFieldIncrement />
            </NumberFieldGroup>
          </NumberField>
        </Field>
        <Field orientation="horizontal">
          <FieldTitle>{tExams("answer-key")}</FieldTitle>
          <ToggleGroup
            onValueChange={(value) => {
              if (value !== "") {
                setKey(value);
              }
            }}
            type="single"
            value={key}
          >
            {Arr.map(OPTIONS, ({ letter }) => (
              <ToggleGroupItem key={letter} value={letter}>
                {letter}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
        <NoteField title={tExams("explanation")}>
          <p className="text-pretty">
            {t.rich("demo-exam-explanation", {
              formula: () => (
                <InlineMath
                  math={
                    "p = m v = 2 \\cdot 3 = 6\\ \\text{kg}\\cdot\\text{m/s}"
                  }
                />
              ),
            })}
          </p>
        </NoteField>
      </FieldGroup>
    </aside>
  );
}

/** The editor's strip of pages, the open one outlined; a press opens a page, as the strip does. */
function PageStrip() {
  const tExams = useTranslations("Exams");
  const tCommon = useTranslations("Common");
  const [open, setOpen] = useState(3);

  return (
    <nav
      aria-label={tExams("pages-label")}
      className="flex gap-3 overflow-x-auto p-3"
    >
      {Arr.map(PAGES, (number) => (
        <button
          aria-current={number === open ? "true" : undefined}
          className={pageThumb({
            className: "grid w-24 place-items-center text-sm tabular-nums",
          })}
          key={number}
          onClick={() => setOpen(number)}
          type="button"
        >
          {tCommon("question", { number })}
        </button>
      ))}
    </nav>
  );
}

/**
 * The exams part, as wide as the page: the School exam editor on one surface, as a teacher works in
 * it. The editor's toolbar runs over the top; the open question with its formulas and options takes
 * the middle and the teacher's layer stands beside it, under each other on a phone; the strip of
 * pages runs along the bottom.
>>>>>>> f9e9c205f0
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

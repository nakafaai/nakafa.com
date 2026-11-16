import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireTitle,
} from "@repo/design-system/components/ui/questionnaire";

const items = [
  { name: "goal", required: true },
  { name: "time", required: true },
];

export const card = {
  name: "Questionnaire",
  group: "Forms",
  height: 420,
  source: "questionnaire",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="max-w-lg p-6">
      <Questionnaire defaultItem="goal" items={items} shortcuts="letters">
        <QuestionnaireProgress
          aria-label="Progress"
          render={(props, { current, total }) => (
            <div {...props}>
              Question {current} of {total}
            </div>
          )}
        />
        <QuestionnaireItem name="goal" required>
          <QuestionnaireTitle>
            What do you want to prepare for?
          </QuestionnaireTitle>
          <QuestionnaireDescription>
            Nina tailors practice to your goal.
          </QuestionnaireDescription>
          <QuestionnaireChoices>
            <QuestionnaireChoice defaultChecked value="snbt">
              SNBT
            </QuestionnaireChoice>
            <QuestionnaireChoice value="school">
              School exams
            </QuestionnaireChoice>
            <QuestionnaireChoice value="olympiad">Olympiad</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
        <QuestionnaireItem name="time" required>
          <QuestionnaireTitle>
            How much time do you have each day?
          </QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="30">30 minutes</QuestionnaireChoice>
            <QuestionnaireChoice value="60">1 hour</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError />
        </QuestionnaireItem>
        <QuestionnaireActions>
          <QuestionnairePrevious />
          <QuestionnaireNext />
        </QuestionnaireActions>
      </Questionnaire>
    </div>
  );
}

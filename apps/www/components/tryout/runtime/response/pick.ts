import { Option } from "effect";
import type {
  PlayerResponseValue,
  PlayerSelection,
} from "@/components/player/response";
import { toggleMultipleChoiceSelection } from "@/components/tryout/runtime/response/state";

type PickValue = Pick<PlayerResponseValue, "responseSpec" | "selection">;

/** Digit shortcut for single choice: selects the option at that position. */
export function pickSingleChoice(
  value: PickValue,
  index: number
): Option.Option<PlayerSelection | null> {
  if (value.responseSpec.kind !== "single-choice") {
    return Option.none();
  }
  return Option.map(
    Option.fromUndefinedOr(value.responseSpec.options[index]),
    (option) => ({ kind: "single-choice", optionKey: option.optionKey })
  );
}

/** Digit shortcut for multiple choice: toggles the option at that position. */
export function pickMultipleChoice(
  value: PickValue,
  index: number
): Option.Option<PlayerSelection | null> {
  if (value.responseSpec.kind !== "multiple-choice") {
    return Option.none();
  }
  return Option.map(
    Option.fromUndefinedOr(value.responseSpec.options[index]),
    (option) => toggleMultipleChoiceSelection(value, option.optionKey)
  );
}

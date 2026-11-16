import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerSearch,
} from "@repo/design-system/components/ui/emoji-picker";

export const card = {
  name: "EmojiPicker",
  group: "Forms",
  height: 380,
  source: "emoji-picker",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="p-6">
      <EmojiPicker className="h-80 border shadow-md">
        <EmojiPickerSearch />
        <EmojiPickerContent />
        <EmojiPickerFooter />
      </EmojiPicker>
    </div>
  );
}

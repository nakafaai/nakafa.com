import {
  ArrowUpRight01Icon,
  InLoveIcon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import { YoutubePlayer } from "@repo/design-system/components/markdown/youtube-player";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Frame,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@repo/design-system/components/ui/frame";
import { useTranslations } from "next-intl";

interface Props {
  videoId: string;
}

export function Youtube({ videoId }: Props) {
  const t = useTranslations("Common");
  return (
    <Frame className="my-4 overflow-hidden content-auto-card">
      <FrameHeader>
        <FrameTitle className="flex items-center gap-2">
          <HugeIcons icon={YoutubeIcon} />
          YouTube
        </FrameTitle>
      </FrameHeader>
      <FramePanel className="overflow-hidden p-0">
        <YoutubePlayer videoId={videoId} />
      </FramePanel>
      <FrameFooter className="flex flex-wrap gap-2">
        <Button
          render={
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("see-on-youtube")}
              <HugeIcons icon={ArrowUpRight01Icon} />
            </a>
          }
          variant="outline"
        />
        <Button
          render={
            <a
              href="https://www.youtube.com/@nakafaa?sub_confirmation=1"
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("subscribe")}
              <HugeIcons icon={InLoveIcon} />
            </a>
          }
        />
      </FrameFooter>
    </Frame>
  );
}

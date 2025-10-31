import type { ImageResponseOptions } from "next/dist/compiled/@vercel/og/types";
import { ImageResponse } from "next/og";
import type { ReactElement, ReactNode } from "react";

const MAX_TITLE_FIRST_LENGTH = 30;
const MAX_TITLE_SECOND_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 80;
const MAX_DESCRIPTION_TRUNCATED_LENGTH = 100;

type GenerateProps = {
  title: ReactNode;
  description?: ReactNode;
};

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.substring(0, maxLength).trim()}...`;
}

export function generateOGImage(
  options: GenerateProps & ImageResponseOptions
): ImageResponse {
  const { title, description, ...rest } = options;

  return new ImageResponse(
    generate({
      title,
      description,
    }),
    {
      width: 1200,
      height: 630,
      ...rest,
    }
  );
}

export function generate(props: GenerateProps): ReactElement {
  // Calculate dynamic font sizes based on content length
  const titleLength = String(props.title).length;
  const descriptionLength = props.description
    ? String(props.description).length
    : 0;

  // Dynamic title font size (larger for shorter titles)
  let titleFontSize = "56px";
  if (titleLength < MAX_TITLE_FIRST_LENGTH) {
    titleFontSize = "72px";
  } else if (titleLength < MAX_TITLE_SECOND_LENGTH) {
    titleFontSize = "64px";
  }

  // Dynamic description font size
  const descriptionFontSize =
    descriptionLength < MAX_DESCRIPTION_LENGTH ? "32px" : "28px";

  // Dynamic gap based on content amount
  const contentGap =
    titleLength < MAX_TITLE_FIRST_LENGTH &&
    descriptionLength < MAX_DESCRIPTION_LENGTH
      ? "32px"
      : "24px";

  const truncatedDescription = props.description
    ? truncateText(String(props.description), MAX_DESCRIPTION_TRUNCATED_LENGTH)
    : undefined;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: "#ffffff",
        position: "relative",
      }}
    >
      {/* Subtle border frame */}
      <div
        style={{
          position: "absolute",
          top: "24px",
          left: "24px",
          right: "24px",
          bottom: "24px",
          border: "1px solid #e5e5e5",
          borderRadius: "16px",
        }}
      />

      {/* Inner subtle border */}
      <div
        style={{
          position: "absolute",
          top: "32px",
          left: "32px",
          right: "32px",
          bottom: "32px",
          border: "1px solid #f5f5f5",
          borderRadius: "12px",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "60px 80px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Content area with controlled spacing */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: contentGap,
            flex: "1",
            minHeight: "0",
          }}
        >
          {/* Simple accent line */}
          <div
            style={{
              width: "48px",
              height: "2px",
              backgroundColor: "#000000",
              marginBottom: "16px",
              flexShrink: 0,
            }}
          />

          <h1
            style={{
              fontWeight: 600,
              fontSize: titleFontSize,
              margin: 0,
              lineHeight: 1.2,
              letterSpacing: "-0.03em",
              color: "#000000",
              wordWrap: "break-word",
              overflowWrap: "break-word",
            }}
          >
            {props.title}
          </h1>

          {truncatedDescription && (
            <p
              style={{
                fontSize: descriptionFontSize,
                color: "#666666",
                margin: 0,
                lineHeight: 1.4,
                fontWeight: 400,
                flexShrink: 0,
                wordWrap: "break-word",
                overflowWrap: "break-word",
              }}
            >
              {truncatedDescription}
            </p>
          )}
        </div>

        {/* Fixed footer that always stays at bottom */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "40px",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            {/* Minimal logo mark */}
            <div
              style={{
                width: "40px",
                height: "40px",
                backgroundColor: "#000000",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                fontWeight: 600,
                color: "#ffffff",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            >
              N
            </div>

            <p
              style={{
                fontSize: "28px",
                fontWeight: 500,
                margin: 0,
                color: "#000000",
                letterSpacing: "-0.01em",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            >
              Nakafa
            </p>
          </div>

          {/* Simple dot accent */}
          <div
            style={{
              width: "4px",
              height: "4px",
              borderRadius: "50%",
              backgroundColor: "#cccccc",
            }}
          />
        </div>
      </div>
    </div>
  );
}

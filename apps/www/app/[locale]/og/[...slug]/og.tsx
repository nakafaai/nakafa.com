import type { PersistentImage } from "@takumi-rs/core";
import { ImageResponse } from "@takumi-rs/image-response";
import anyAscii from "any-ascii";
import type { ReactNode } from "react";

interface GenerateProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  primaryColor?: string;
  primaryTextColor?: string;
  site?: ReactNode;
}

const [logo] = await Promise.all([
  fetch("https://nakafa.com/logo.svg").then((res) => res.arrayBuffer()),
]);

const persistentImages: PersistentImage[] = [
  {
    src: "logo",
    data: logo,
  },
];

export function generateOGImage(
  options: GenerateProps & { width?: number; height?: number }
): Response {
  const { title, description, width = 1200, height = 630 } = options;

  return new ImageResponse(
    <OgImage description={description} title={title} />,
    {
      width,
      height,
      persistentImages,
    }
  );
}

export function OgImage(props: GenerateProps) {
  const {
    title,
    description,
    icon = (
      <div
        style={{
          width: 48,
          height: 48,
          backgroundImage: "url(logo)",
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          borderRadius: "50%",
        }}
      />
    ),
    primaryColor = "hsla(21.74, 66%, 55%, 1)",
    primaryTextColor = "hsla(21.74, 66%, 55%, 1)",
    site = "Nakafa",
  } = props;

  const sanitizedTitle = anyAscii(String(title));
  const sanitizedDescription = description
    ? anyAscii(String(description))
    : undefined;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "hsl(300 50% 100%)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        color: "hsl(220.91 39% 11%)",
        backgroundImage: `linear-gradient(to bottom right, ${primaryColor}, transparent)`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "60px",
          position: "relative",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "32px",
            marginBottom: "40px",
            textWrap: "pretty",
          }}
        >
          <span
            style={{
              fontSize: 72,
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: "-0.04em",
              color: "hsl(220.91 39% 11%)",
              lineClamp: 3,
              textOverflow: "ellipsis",
              overflow: "hidden",
            }}
          >
            {sanitizedTitle}
          </span>
          {!!sanitizedDescription && (
            <span
              style={{
                fontSize: 36,
                color: "hsl(220.91 39% 11%)",
                opacity: 0.8,
                fontWeight: 400,
                lineHeight: 1.4,
                maxWidth: "95%",
                letterSpacing: "-0.01em",
                lineClamp: 2,
                textOverflow: "ellipsis",
                overflow: "hidden",
              }}
            >
              {sanitizedDescription}
            </span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "28px",
          }}
        >
          {icon}
          <span
            style={{
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "hsl(220.91 39% 11%)",
              opacity: 0.9,
            }}
          >
            {site}
          </span>
          <div style={{ flexGrow: 1 }} />
          <div
            style={{
              height: 4,
              width: 60,
              backgroundColor: primaryColor,
              borderRadius: 2,
            }}
          />
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: primaryTextColor,
              opacity: 0.8,
            }}
          >
            Copyright © {new Date().getFullYear()} Nakafa
          </span>
        </div>
      </div>
    </div>
  );
}

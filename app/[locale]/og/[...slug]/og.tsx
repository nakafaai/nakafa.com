import type { ImageResponseOptions } from "next/dist/compiled/@vercel/og/types";
import { ImageResponse } from "next/og";
import type { ReactElement, ReactNode } from "react";

interface GenerateProps {
  title: ReactNode;
  description?: ReactNode;
  primaryTextColor?: string;
}

export function generateOGImage(
  options: GenerateProps & ImageResponseOptions
): ImageResponse {
  const { title, description, primaryTextColor, ...rest } = options;

  return new ImageResponse(
    generate({
      title,
      description,
      primaryTextColor,
    }),
    {
      width: 1200,
      height: 630,
      ...rest,
    }
  );
}

export function generate({
  primaryTextColor = "rgb(255,150,255)",
  ...props
}: GenerateProps): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        color: "#f4f4f5",
        backgroundColor: "rgb(10,10,10)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "60px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          <h1
            style={{
              fontWeight: 700,
              fontSize: "64px",
              margin: 0,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
            }}
          >
            {props.title}
          </h1>
          <p
            style={{
              fontSize: "32px",
              color: "rgba(240,240,240,0.8)",
              margin: 0,
              lineHeight: 1.4,
              maxWidth: "960px",
            }}
          >
            {props.description}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "16px",
            marginTop: "40px",
            color: primaryTextColor,
          }}
        >
          <p
            style={{
              fontSize: "36px",
              fontWeight: 700,
              margin: 0,
            }}
          >
            Nakafa
          </p>
        </div>
      </div>
    </div>
  );
}

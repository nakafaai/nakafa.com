import Image from "next/image";

export function Promote() {
  // hide safely for screen readers
  return (
    <div className="sr-only flex">
      <a
        href="https://startupfa.me/s/nakafa?utm_source=nakafa.com"
        target="_blank"
        rel="noreferrer"
      >
        <Image
          src="https://startupfa.me/badges/featured-badge.webp"
          alt="Featured on Startup Fame"
          width="171"
          height="54"
        />
      </a>
      <a href="https://twelve.tools" target="_blank" rel="noreferrer">
        <Image
          src="https://twelve.tools/badge1-light.svg"
          alt="Featured on Twelve Tools"
          width="200"
          height="54"
        />
      </a>
    </div>
  );
}

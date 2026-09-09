import { ImageResponse } from "next/og";
import { tmdbImageUrl } from "../tmdb/images";

function SocialMark({ size = 54 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96">
      <circle cx="48" cy="48" r="45" fill="#171714" />
      <circle
        cx="48"
        cy="48"
        r="40"
        fill="none"
        stroke="#f4f0e7"
        strokeWidth="1"
      />
      <path
        fill="#f4f0e7"
        d="M27 72v-4.4l5.7-2V31L27 29v-4.5h24.7c13.1 0 21 6.1 21 16.4 0 7.8-4.8 13.2-13.3 15.4l10.9 10.5 4.7.9V72H60.2L46.4 57.7h-2.9V65l6.1 2.5V72Zm16.5-19.8h5.8c7.1 0 11-3.6 11-10.6 0-7.5-3.7-11.8-10.8-11.8h-6Z"
      />
      <circle cx="73.5" cy="25.5" r="5" fill="#dfff59" stroke="#171714" />
    </svg>
  );
}
export async function socialCard({
  eyebrow,
  title,
  subtitle,
  detail,
  posterPath,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  detail: string;
  posterPath?: string | null;
}) {
  let poster: string | null = null;
  const url = tmdbImageUrl(posterPath ?? null, "w342");
  if (url) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(4000),
        next: { revalidate: 86400 },
      });
      if (
        response.ok &&
        response.headers.get("content-type")?.startsWith("image/")
      ) {
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength < 3_000_000)
          poster = `data:${response.headers.get("content-type")};base64,${Buffer.from(bytes).toString("base64")}`;
      }
    } catch {
      /* Keep the share card available if artwork cannot be loaded. */
    }
  }
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#f4f0e7",
        color: "#171714",
        fontFamily: "sans-serif",
        padding: 54,
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid #171714",
          paddingBottom: 20,
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <SocialMark />
          <span style={{ fontSize: 34, fontWeight: 900, letterSpacing: -2 }}>
            RUNSCARS
          </span>
        </div>
        <span style={{ fontSize: 18, letterSpacing: 2 }}>
          {eyebrow.slice(0, 75)}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 42,
          flex: 1,
          paddingTop: 28,
          paddingBottom: 28,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div
            style={{
              fontSize: title.length > 60 ? 44 : 60,
              fontWeight: 900,
              letterSpacing: -2,
              lineHeight: 1.08,
            }}
          >
            {title.slice(0, 135)}
          </div>
          <div
            style={{
              fontSize: 26,
              lineHeight: 1.4,
              marginTop: 24,
              color: "#5a5147",
            }}
          >
            {subtitle.slice(0, 160)}
          </div>
        </div>
        {poster ? (
          <div
            style={{
              display: "flex",
              width: 210,
              height: 315,
              boxShadow: "8px 8px 0 #bd4d2c",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={poster}
              width={210}
              height={315}
              alt=""
              style={{ objectFit: "cover" }}
            />
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              width: 180,
              height: 230,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 175,
              color: "#bd4d2c",
            }}
          >
            <SocialMark size={180} />
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 18,
          borderTop: "1px solid #b9b1a4",
          paddingTop: 20,
        }}
      >
        <span>{detail.slice(0, 100)}</span>
        <span>runscars.app ↗</span>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
      },
    },
  );
}

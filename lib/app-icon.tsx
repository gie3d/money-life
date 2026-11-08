import { ImageResponse } from "next/og";

/**
 * The app's icon as a PNG: the sprout of the logo on its peach background, drawn as paths so it needs no emoji font.
 * iPhone and Android round the corners themselves, so the square is filled edge to edge.
 */
export function appIcon(size: number) {
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff0e6" }}>
        <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 100 100">
          <path d="M50 90 C50 72 50 60 50 44" stroke="#248a3d" strokeWidth="7" strokeLinecap="round" fill="none" />
          <path d="M50 62 C28 62 14 50 12 30 C34 29 50 42 50 62 Z" fill="#34c759" />
          <path d="M50 46 C50 26 63 12 88 10 C90 32 76 46 50 46 Z" fill="#248a3d" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}

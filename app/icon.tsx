import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Branded favicon: the Pagecraft layout mark on the brand gradient.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg,#6366F1,#4338CA)",
          borderRadius: 8,
        }}
      >
        <div style={{ display: "flex", gap: 2.5 }}>
          <div style={{ width: 5, height: 16, background: "#fff", borderRadius: 2 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <div style={{ width: 9, height: 5, background: "#fff", borderRadius: 1.5 }} />
            <div style={{ width: 9, height: 8.5, background: "rgba(255,255,255,0.6)", borderRadius: 2 }} />
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

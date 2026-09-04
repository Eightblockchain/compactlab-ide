"use client";

/**
 * Root-level error UI for failures outside route segments (e.g. root layout).
 * Keep styles inline: global CSS may not load when the root fails.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d0d0d",
          color: "#e8e8e6",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            CompactLab hit an unexpected error
          </p>
          <p style={{ fontSize: 13, color: "#8a8a86", marginBottom: 16, lineHeight: 1.5 }}>
            {error.message || "Something went wrong. Try again or reload the page."}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "#E95144",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

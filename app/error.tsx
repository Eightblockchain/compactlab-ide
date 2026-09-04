"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[CompactLab]", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        background: "#0d0d0d",
        color: "#e8e8e6",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        padding: 24,
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: 14, fontWeight: 600 }}>Something went wrong in CompactLab</p>
      <p style={{ fontSize: 12, color: "#8a8a86", maxWidth: 420, lineHeight: 1.5 }}>
        {error.message || "An unexpected error occurred. Your projects are safe in the cloud. Try again."}
      </p>
      <button
        type="button"
        onClick={reset}
        style={{
          marginTop: 8,
          background: "#E95144",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}

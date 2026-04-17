/**
 * Hello Midnight – Page Entry Point
 *
 * Uses next/dynamic with ssr: false to prevent the Midnight SDK (which loads
 * WASM via readFileSync on Node.js) from being evaluated during server-side
 * rendering. The DApp only works in the browser with the Lace wallet extension.
 */
"use client";

import dynamic from "next/dynamic";

const HelloMidnightApp = dynamic(
  () => import("./HelloMidnightApp"),
  {
    ssr: false,
    loading: () => (
      <main
        style={{
          minHeight: "100vh",
          background: "#0f1117",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#636360",
          fontFamily: "monospace",
          fontSize: "13px",
        }}
      >
        Loading…
      </main>
    ),
  }
);

export default function HelloMidnightPage() {
  return <HelloMidnightApp />;
}

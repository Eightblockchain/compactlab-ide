import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Turbopack config for Next.js 16+ (default bundler)
  // Handles Midnight SDK module resolution issues.
  turbopack: {
    resolveAlias: {
      // isomorphic-ws browser.js only exports default; Midnight SDK accesses
      // `ws.WebSocket` via `import * as ws`. Our shim exports both.
      "isomorphic-ws": "./shims/isomorphic-ws.js",
      // midnight-js-contracts does `import 'fs'` at the top level for server-side
      // file loading. In browser context this fails; replace with empty shim.
      // NOTE: 'path' is NOT aliased here because server-side code needs the real path module.
      "fs": "./shims/empty.js",
      // Force a single WASM-bearing Midnight package instance. Duplicate copies
      // break instanceof checks (e.g. "expected instance of CostModel").
      // IMPORTANT: alias to the real package path — do NOT alias through a
      // re-export shim (that creates a circular resolve and zero exports).
      "@midnight-ntwrk/compact-js": "./node_modules/@midnight-ntwrk/compact-js",
      "@midnight-ntwrk/compact-runtime": "./node_modules/@midnight-ntwrk/compact-runtime",
      "@midnight-ntwrk/ledger-v8": "./node_modules/@midnight-ntwrk/ledger-v8",
      "@midnight-ntwrk/onchain-runtime-v3": "./node_modules/@midnight-ntwrk/onchain-runtime-v3",
    },
  },

  // Webpack config kept as fallback (used when --webpack flag is passed)
  webpack(config, { isServer }) {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
    });

    config.resolve.alias = {
      ...config.resolve.alias,
      "isomorphic-ws": path.resolve(__dirname, "shims/isomorphic-ws.js"),
    };

    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        buffer: require.resolve("buffer/"),
      };
    }

    return config;
  },

  // Headers for security + WASM
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Cross-origin isolation for WASM/SharedArrayBuffer.
          // Use credentialless (not require-corp): Lace/Midnight extension injection
          // commonly breaks under require-corp. Keep COOP allow-popups for wallet UI.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
      {
        // Serve .wasm files with correct MIME type and CORP header
        source: "/contracts/(.*)\\.wasm",
        headers: [
          { key: "Content-Type", value: "application/wasm" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
      {
        // Serve all contract assets with CORP header + CORS so wallet service workers can load ZK keys
        source: "/contracts/(.*)",
        headers: [
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
        ],
      },
    ];
  },
};

export default nextConfig;

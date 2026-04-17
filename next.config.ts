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
          // COOP+COEP required for SharedArrayBuffer / WASM threads
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
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
        // Serve all contract assets with CORP header
        source: "/contracts/(.*)",
        headers: [
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;

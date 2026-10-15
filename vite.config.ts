// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  vite: {
    plugins: [VitePWA({
      strategies: "generateSW",
      outDir: "dist/client",
      filename: "sw.js",
      registerType: "autoUpdate",
      injectRegister: null,
      devOptions: { enabled: false },
      manifest: false,
      includeAssets: ["offline.html", "icons/*.png"],
      workbox: {
        globDirectory: "dist/client",
        globPatterns: ["offline.html", "icons/*.png"],
        navigateFallback: null,
        cleanupOutdatedCaches: false,
        runtimeCaching: [
          {
            // Never reuse SSR room HTML, OAuth responses or server-function data.
            urlPattern: ({ url, request }) => url.origin === self.location.origin && request.mode === "navigate" && !url.search && (url.pathname === "/" || /^\/sala\/[A-Za-z0-9]{5}\/?$/.test(url.pathname)),
            handler: "NetworkFirst",
            options: { cacheName: "imperios-navigation", cacheableResponse: { statuses: [] }, precacheFallback: { fallbackURL: "/offline.html" } },
          },
          {
            urlPattern: ({ url }) => url.origin === self.location.origin && !url.search && /^\/assets\/.+-[\w-]{8,}\.(js|css|woff2?)$/.test(url.pathname),
            handler: "CacheFirst",
            options: { cacheName: "imperios-hashed-assets-v1", expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 90 }, cacheableResponse: { statuses: [200] } },
          },
          {
            urlPattern: ({ url }) => url.origin === self.location.origin && !url.search && (/^\/(cartas|aurelia|nihara|thalassa|maravilhas|icons)\/.+\.(webp|png|jpg|svg)$/.test(url.pathname) || /^\/(cenario-imperios|cenario-acampamento|box-imperios|ficha-[\w-]+|[\w]+-bandeja)\.(webp|svg)$/.test(url.pathname)),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "imperios-art-v1", expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 }, cacheableResponse: { statuses: [200] } },
          },
        ],
      },
    })],
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});

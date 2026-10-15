/** Browser-safe rules shared by registration, the build configuration and tests. */
export function refuseServiceWorker(production: boolean, framed: boolean, hostname: string, search: string) {
  return !production || framed || hostname.startsWith("id-preview--") || hostname.startsWith("preview--") ||
    ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)) ||
    new URLSearchParams(search).get("sw") === "off";
}

export function isStaticGameAsset(url: URL, origin: string) {
  return url.origin === origin && !url.search &&
    (/^\/assets\/.+-[\w-]{8,}\.(js|css|woff2?)$/.test(url.pathname) ||
      /^\/(cartas|aurelia|nihara|thalassa|maravilhas|icons)\/[^?]+\.(webp|png|jpg|svg)$/.test(url.pathname) ||
      /^\/(cenario-imperios|cenario-acampamento|box-imperios|ficha-[\w-]+|[\w]+-bandeja)\.(webp|svg)$/.test(url.pathname));
}

export function isGameNavigation(url: URL, origin: string, mode: string) {
  return url.origin === origin && mode === "navigate" && !url.search &&
    (url.pathname === "/" || /^\/sala\/[A-Za-z0-9]{5}\/?$/.test(url.pathname));
}
import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RCA Agent — دستیار شخصی",
    short_name: "RCA Agent",
    description: "دستیار شخصی هوشمند: کارها، یادآور دارو، خلاصه‌ی ایمیل",
    lang: "fa",
    dir: "rtl",
    start_url: `${base}/dashboard/`,
    scope: `${base}/`,
    display: "standalone",
    background_color: "#0b0b12",
    theme_color: "#5b4cf0",
    icons: [
      { src: `${base}/icon.svg`, sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: `${base}/icon.svg`, sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}

import type { MetadataRoute } from "next";
import { siteDescription, siteName } from "@/lib/brand";
import { defaultTheme, themes } from "@/lib/themes";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteName, short_name: siteName, start_url: "/", scope: "/",
    display: "standalone", background_color: themes[defaultTheme].color, theme_color: themes[defaultTheme].color,
    description: siteDescription,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "./globals.css";
import { siteOrigin } from "@/lib/format";
import { OfflineSetup } from "@/components/offline";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: { default: "Nightfolio | Independent Manga Library", template: "%s | Nightfolio" },
  description: "Browse original manga, find your next chapter, and pick up where you left off.",
  openGraph: { title: "Nightfolio", description: "An independent manga library.", images: ["/icon-512.png"], type: "website" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Nightfolio" },
};
export const viewport: Viewport = { colorScheme: "dark light", themeColor: "#131219" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: "try{document.documentElement.dataset.theme=localStorage.getItem('nightfolio:theme')==='light'?'light':'dark'}catch{}" }} /></head>
    <body>
      <a className="skip-link" href="#main">Skip to content</a>
      {children}
      <OfflineSetup />
      {process.env.ENABLE_ANALYTICS === "true" && <Analytics />}
    </body>
  </html>;
}

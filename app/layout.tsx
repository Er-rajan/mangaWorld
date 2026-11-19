import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "./globals.css";
import { siteOrigin } from "@/lib/format";
import { OfflineSetup } from "@/components/offline";
import { ThemeSync } from "@/components/theme";
import { authorName, siteBanner, siteDescription, siteName } from "@/lib/brand";
import { defaultTheme, themeStorageKey, themes } from "@/lib/themes";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: { default: `${siteName} | Original manga by ${authorName}`, template: `%s | ${siteName}` },
  description: siteDescription,
  openGraph: { title: siteName, description: siteDescription, images: [siteBanner], type: "website" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: siteName },
};
export const viewport: Viewport = { colorScheme: "dark light", themeColor: themes[defaultTheme].color };
const themeScript = `try{const theme=localStorage.getItem(${JSON.stringify(themeStorageKey)});if(${JSON.stringify(Object.keys(themes))}.includes(theme))document.documentElement.dataset.theme=theme}catch{}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-theme={defaultTheme} suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
    <body>
      <a className="skip-link" href="#main">Skip to content</a>
      {children}
      <ThemeSync />
      <OfflineSetup />
      {process.env.ENABLE_ANALYTICS === "true" && <Analytics />}
    </body>
  </html>;
}

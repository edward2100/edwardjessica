import type { Metadata, Viewport } from "next";
import { GuestMusicProvider } from "@/components/site/background-music";
import { getSiteUrl } from "@/lib/env";
import "@/app/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "The Wedding of Edward & Jessica",
  description: "Join us as we celebrate our wedding on 12 December 2026 · Medan.",
  openGraph: {
    title: "The Wedding of Edward & Jessica",
    description: "Join us as we celebrate our wedding on 12 December 2026 · Medan.",
    type: "website",
    images: ["/assets/wedding-hero-placeholder.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Wedding of Edward & Jessica",
    description: "Join us as we celebrate our wedding on 12 December 2026 · Medan.",
    images: ["/assets/wedding-hero-placeholder.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#fffaf1",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <GuestMusicProvider>{children}</GuestMusicProvider>
      </body>
    </html>
  );
}

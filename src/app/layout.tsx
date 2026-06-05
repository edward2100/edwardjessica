import type { Metadata, Viewport } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "Edward & Jessica Wedding",
  description: "Wedding invitation and RSVP website for Edward and Jessica.",
  openGraph: {
    title: "The Wedding of Edward & Jessica",
    description: "Together with our families, we invite you to celebrate our wedding.",
    type: "website",
    images: ["/assets/wedding-hero-placeholder.png"]
  }
};

export const viewport: Viewport = {
  themeColor: "#fffaf1",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}

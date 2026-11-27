import type { Metadata } from "next";
import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { BRAND_NAME } from "@/lib/brand";
import { THEME_SCRIPT } from "@/lib/theme";

// Display serif for page titles and greetings. Everything else is Geist.
const instrument = localFont({ src: "./fonts/InstrumentSerif-Regular.woff2", variable: "--font-instrument", weight: "400", display: "swap" });

export const metadata: Metadata = {
  title: { default: BRAND_NAME, template: `%s · ${BRAND_NAME}` },
  description: `Recruitment workspace · ${BRAND_NAME}`,
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: THEME_SCRIPT sets data-theme on <html> before React loads.
    <html lang="en-IN" className={`${GeistSans.variable} ${GeistMono.variable} ${instrument.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans text-[14px]">{children}</body>
    </html>
  );
}

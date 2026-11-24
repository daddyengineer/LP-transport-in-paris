import type { Metadata } from "next";
import Script from "next/script";
import { Inter, JetBrains_Mono, Outfit } from "next/font/google";
import "./built-home.css";
import "./mobile-home.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

const UMAMI_WEBSITE_ID = "baf4ae47-b76f-40c1-b563-7c33100e9b0c";

const TITLE = "Paris Airport Transfers | CDG, Orly | Fixed USD";
const DESCRIPTION = "Book a private CDG or Orly airport transfer with an English-speaking chauffeur. See a fixed USD price before you pay, with flight tracking included.";
const OG_IMAGE = "/images/v/hero.dd5f47ba.1440.jpg";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.transportinparis.com"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://www.transportinparis.com/",
    siteName: "Transport in Paris",
    locale: "en_US",
    type: "website",
    images: [{ url: OG_IMAGE, width: 1440, height: 722, alt: "Private chauffeur van in Paris" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} ${mono.variable}`}>
      <body>
        {children}
        <Script
          src="https://analytics.kolaborasi.xyz/script.js"
          strategy="afterInteractive"
          data-website-id={UMAMI_WEBSITE_ID}
        />
        <Script
          src="https://analytics.kolaborasi.xyz/recorder.js"
          strategy="afterInteractive"
          data-website-id={UMAMI_WEBSITE_ID}
        />
      </body>
    </html>
  );
}

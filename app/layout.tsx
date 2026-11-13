import type { Metadata } from "next";
import Script from "next/script";
import { Inter, JetBrains_Mono, Outfit } from "next/font/google";
import "./built-home.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

const UMAMI_WEBSITE_ID = "baf4ae47-b76f-40c1-b563-7c33100e9b0c";

export const metadata: Metadata = {
  title: "Transport in Paris",
  description: "Private airport transfers and chauffeurs in Paris. Fixed price in USD.",
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

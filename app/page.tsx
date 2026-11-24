import type { Metadata } from "next";
import HomePage from "@/components/HomePage";
import MobileHome from "@/components/MobileHome";
import { FAQ } from "@/lib/faq";

const SITE = "https://www.transportinparis.com/";

export const metadata: Metadata = {
  alternates: {
    canonical: SITE,
    languages: {
      en: SITE,
      "x-default": SITE,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "TaxiService",
      name: "Transport in Paris",
      url: SITE,
      image: `${SITE}images/v/hero.dd5f47ba.1440.jpg`,
      telephone: "+1-332-296-1375",
      email: "bonjour@transportinparis.com",
      areaServed: { "@type": "City", name: "Paris" },
      currenciesAccepted: "USD",
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ],
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="desktop-home">
        <HomePage textUsNumber="" />
      </div>
      <MobileHome />
    </>
  );
}

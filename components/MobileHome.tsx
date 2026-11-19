"use client";

import { useMemo, useState } from "react";
import { priceQuote, validateQuote, type QuoteInput } from "@/lib/quote";
import photos from "./photos.json";

type Photo = { src: string; w: number; h: number; sizes: string; jpg: string; webp: string; avif: string };
const PHOTO = photos as Record<string, Photo>;

const SMS = `sms:+13322961375?body=${encodeURIComponent("Hi, I'd like a private airport transfer in Paris.")}`;

const FLEET = [
  { id: "premium-van", name: "Premium Van", model: "Mercedes V-Class or similar", pax: 7, bags: 7, fromPrice: 170, priorPrice: 220, badges: ["Child seat", "Wi-Fi", "Family"], image: "/images/fleet-premium-van.jpg", alt: "Black Mercedes V-Class" },
  { id: "vip-van", name: "VIP Van", model: "Mercedes Sprinter or similar", pax: 8, bags: 8, fromPrice: 180, priorPrice: 230, badges: ["Child seat", "Water", "Family"], image: "/images/fleet-vip-van.jpg", alt: "Black Mercedes Sprinter" },
  { id: "economy-van", name: "Economy Van", model: "Nissan Primastar or similar", pax: 7, bags: 6, fromPrice: 150, priorPrice: 200, badges: ["Child seat", "Water", "Family"], image: "/images/fleet-economy-van.jpg", alt: "Black economy van" },
  { id: "compact-suv", name: "Compact SUV", model: "Lexus RX / Peugeot 5008 or similar", pax: 5, bags: 4, fromPrice: 120, priorPrice: 170, badges: ["Child seat", "Couple"], image: "/images/fleet-compact-suv.jpg", alt: "Black compact SUV" },
  { id: "big-van", name: "Big Van", model: "Mercedes Sprinter or similar", pax: 16, bags: 12, fromPrice: 280, priorPrice: 330, badges: ["Big group", "Child seat", "Water"], image: "/images/fleet-vip-van.jpg", alt: "Black group van" },
  { id: "luxury-sedan", name: "Luxury Sedan", model: "Mercedes E-class or similar", pax: 3, bags: 3, fromPrice: 350, priorPrice: 400, badges: ["Water", "Wi-Fi", "Couple"], image: "/images/fleet-luxury-sedan.jpg", alt: "Black Mercedes sedan" },
] as const;

const PLACES = [
  "CDG · Paris Charles de Gaulle Airport", "ORY · Paris Orly Airport", "BVA · Paris Beauvais Airport", "Gare du Nord, Paris",
  "Le Marais hotel, Paris", "Louvre, Paris center", "Eiffel Tower, Paris", "Notre-Dame, Paris", "Arc de Triomphe, Paris",
  "Sacré-Cœur, Montmartre, Paris", "Musée d'Orsay, Paris", "Champs-Élysées, Paris", "Latin Quarter, Paris",
  "Sainte-Chapelle, Paris", "Luxembourg Gardens, Paris", "Opéra Garnier, Paris", "Disneyland Paris", "Palace of Versailles", "Champagne, Reims",
];

const TIMES = (() => {
  const out: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 15, 30, 45]) {
      const suffix = hour < 12 ? "AM" : "PM";
      const display = hour % 12 === 0 ? 12 : hour % 12;
      out.push(`${display}:${minute.toString().padStart(2, "0")} ${suffix}`);
    }
  }
  return out;
})();

const ROUTES = [
  { id: "cdg", title: "CDG (Charles de Gaulle)", meta: "~45–60 min · 30 km", filter: "CDG", bullets: ["Meet & greet inside arrivals", "Terminal guide 2E / 2F / 1", "Free waiting if flight is delayed"], pickup: "CDG · Paris Charles de Gaulle Airport", dropoff: "Le Marais hotel, Paris", service: "airport", thumb: "/images/route-cdg.jpg", alt: "Aircraft at a jet bridge during sunset" },
  { id: "ory", title: "Orly (ORY)", meta: "~35–45 min · 18 km", filter: "Orly", bullets: ["Pickup at Orly 1–4", "Intra-Europe & US connections"], pickup: "ORY · Paris Orly Airport", dropoff: "Le Marais hotel, Paris", service: "airport", thumb: "/images/route-orly.jpg", alt: "Paris Orly terminal at dusk" },
  { id: "bva", title: "Beauvais (BVA)", meta: "~75–90 min · 85 km", filter: "Beauvais", bullets: ["Far more comfortable than the shuttle bus", "Door-to-door, fixed price"], pickup: "BVA · Paris Beauvais Airport", dropoff: "Le Marais hotel, Paris", service: "airport", thumb: "/images/route-beauvais.jpg", alt: "Beauvais airport terminal and control tower" },
  { id: "disney", title: "Disneyland Paris", meta: "~45 min · 40 km", filter: "Disneyland", bullets: ["Free child seats, large family vans", "Direct from CDG or your Paris hotel"], pickup: "Le Marais hotel, Paris", dropoff: "Disneyland Paris", service: "private", thumb: "/images/route-disney.jpg", alt: "Disneyland Paris castle lit at night" },
  { id: "versailles", title: "Versailles", meta: "Half-day · ~40 min each way", filter: "Versailles", bullets: ["Driver waits during your visit", "Palace ticket option"], pickup: "Le Marais hotel, Paris", dropoff: "Palace of Versailles", service: "private", thumb: "/images/route-versailles.jpg", alt: "Palace of Versailles courtyard at sunset" },
  { id: "normandy", title: "Normandy (Omaha Beach Memorial)", meta: "Full day · ~3 h each way", filter: "Normandy", bullets: ["D-Day beaches & American Cemetery", "A favorite with US travelers"], pickup: "Le Marais hotel, Paris", dropoff: "Normandy American Cemetery", service: "private", thumb: "/images/route-normandy.jpg", alt: "Omaha Beach memorial sculpture on the sand" },
  { id: "champagne", title: "Champagne (Reims / Épernay)", meta: "Full day · ~1 h 45 each way", filter: "Champagne", bullets: ["Visit champagne houses", "A strong New Year day trip"], pickup: "Le Marais hotel, Paris", dropoff: "Champagne, Reims", service: "private", thumb: "/images/route-champagne.jpg", alt: "Ripe grapes on the vine in a Champagne vineyard" },
] as const;

const FILTERS = ["All", "CDG", "Orly", "Beauvais", "Disneyland", "Versailles", "Normandy", "Champagne"];

const REVIEWS = [
  { id: "sarah", quote: "He was right there with my name!", name: "Sarah, Toronto", trip: "Private Trip · Normandy", duration: "", video: "/videos/review-james.23ad4b43.mp4" },
  { id: "millers", quote: "Car seats ready for both kids.", name: "Matt, New York", trip: "Private Trip · Mont Saint-Michel", duration: "0:41", video: "/videos/review-sarah.71f0d5fd.mp4" },
  { id: "james", quote: "Unforgettable D-Day tour.", name: "Adam, Chicago", trip: "Airport Transfer CDG", duration: "0:28", video: "/videos/review-millers.b7937428.mp4" },
];

const FAQ = [
  { q: "Which vehicle fits my luggage?", a: "Sedan: 2–3 suitcases. V-Class: 6–7. Minibus for groups. Enter your bags in the form and we suggest a class." },
  { q: "How do I get the Printemps shopping perks?", a: "Once your booking is confirmed, we email and text you one invitation per passenger. Show it at the Printemps Salon, 4th floor, Women’s store. Valid until 31 Dec 2026." },
  { q: "How long does Beauvais / Normandy take?", a: "Beauvais is about 75–90 minutes (85 km) from central Paris. A Normandy day is a full day, about 3 hours each way to the D-Day beaches and the American Cemetery." },
  { q: "Do I tip the driver?", a: "Tipping is welcome and never required. A common thank-you from North American travelers is about 5–10% in cash." },
  { q: "Can I get a child seat?", a: "Yes. Infant and booster seats are free. Add the children’s ages in the notes and we bring the right seat." },
  { q: "What if my flight is late?", a: "We track the flight. Waiting is free for 60 minutes after landing at CDG and Orly, including when the inbound flight is delayed." },
  { q: "Can I pay in USD?", a: "Yes. The price you see is a fixed amount in USD. Card checkout is Stripe. Until that key is connected, the Pay button saves the quote and does not charge a card." },
  { q: "What's the cancellation policy?", a: "Free cancellation up to 24 hours before pickup." },
  { q: "Why not just use Uber?", a: "From the airport, a private transfer is a fixed price, a meet and greet inside arrivals, and a vehicle sized for the luggage. Rideshare pickup is outside the terminal, and the fare can surge." },
];

const COMPARE = [
  ["Pickup", "Outside the terminal, queue", "Meet & greet inside arrivals"],
  ["Price", "Surge at peak times", "Fixed, known before you pay"],
  ["Luggage", "2+ suitcases often won’t fit", "Sized to your vehicle class"],
  ["Child seat", "Rarely available", "Bookable, very minimum fee"],
  ["Flight delay", "May be cancelled / re-charged", "Free waiting + flight tracking"],
  ["Language", "Varies by driver", "English-speaking chauffeur"],
  ["Payment", "Foreign cards sometimes rejected", "Stripe · Apple Pay · Google Pay · Amex"],
  ["Groups", "Often 2–3 separate cars", "One van for everyone"],
];

type Trip = {
  service: string; tripType: string; pickup: string; dropoff: string; date: string; time: string;
  returnDate: string; returnTime: string; passengers: number; luggage: number; vehicleId: string;
  flight: string; notes: string;
};
type Contact = { name: string; email: string; mobile: string; contactPref: string };

const FILLER: Contact = { name: "Alex Traveler", email: "alex@example.com", mobile: "2125550100", contactPref: "text" };

function showStill(node: HTMLVideoElement | null) {
  if (!node || node.dataset.framed === "1") return;
  const frame = () => {
    if (node.dataset.framed === "1" || node.readyState < 1) return;
    node.dataset.framed = "1";
    if (node.currentTime < 0.2) node.currentTime = 0.4;
  };
  if (node.readyState >= 1) frame();
  else node.addEventListener("loadedmetadata", frame, { once: true });
}

function Picture({ src, alt, className, priority }: { src: string; alt: string; className?: string; priority?: boolean }) {
  const photo = PHOTO[src];
  if (!photo) return <img className={className} src={src} alt={alt} />;
  return (
    <picture>
      <source type="image/avif" srcSet={photo.avif} sizes="100vw" />
      <source type="image/webp" srcSet={photo.webp} sizes="100vw" />
      <img className={className} src={photo.src} alt={alt} width={photo.w} height={photo.h} sizes="100vw" srcSet={photo.jpg} decoding="async" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} />
    </picture>
  );
}

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className={dark ? "m-logo m-logoDark" : "m-logo"}>
      transport<i>in</i>paris
    </span>
  );
}

function money(usd: number) {
  return `$${usd.toLocaleString("en-US")}`;
}

function peak(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return false;
  const month = Number(match[1]);
  const day = Number(match[2]);
  return (month === 12 && day >= 24 && day <= 26) || (month === 12 && day === 31) || (month === 1 && day === 1);
}

function formatPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  const head = digits.slice(0, 10);
  const extra = digits.slice(10, 14);
  const body = head.length < 4 ? head : head.length < 7 ? `(${head.slice(0, 3)}) ${head.slice(3)}` : `(${head.slice(0, 3)}) ${head.slice(3, 6)}-${head.slice(6)}`;
  return extra ? `${body}${extra}` : body;
}

function toInput(trip: Trip, contact: Contact): QuoteInput {
  return { ...trip, ...contact, smsOptIn: false };
}

export default function MobileHome() {
  const [menu, setMenu] = useState(false);
  const [vehicleId, setVehicleId] = useState("premium-van");
  const [filter, setFilter] = useState("All");
  const [openFaq, setOpenFaq] = useState<number[]>([0, 1]);
  const [fineOpen, setFineOpen] = useState(true);
  const [playing, setPlaying] = useState("");
  const [dot, setDot] = useState(0);
  const [step, setStep] = useState(1);
  const [notesOpen, setNotesOpen] = useState(false);
  const [suggest, setSuggest] = useState<"pickup" | "dropoff" | "">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [busy, setBusy] = useState(false);
  const [trip, setTrip] = useState<Trip>({
    service: "airport", tripType: "oneway", pickup: "", dropoff: "", date: "", time: "",
    returnDate: "", returnTime: "", passengers: 1, luggage: 1, vehicleId: "premium-van",
    flight: "", notes: "",
  });
  const [contact, setContact] = useState<Contact>({ name: "", email: "", mobile: "", contactPref: "text" });

  const current = useMemo(() => ({ ...trip, vehicleId }), [trip, vehicleId]);
  const vehicle = FLEET.find((item) => item.id === vehicleId) ?? FLEET[0];
  const price = useMemo(() => priceQuote(current), [current]);
  const shownRoutes = ROUTES.filter((route) => filter === "All" || route.filter === filter);

  function patchTrip(patch: Partial<Trip>) {
    setTrip((prev) => ({ ...prev, ...patch }));
    setError("");
    setNotice("");
  }

  function go(id: string) {
    setMenu(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function bookRoute(route: (typeof ROUTES)[number]) {
    patchTrip({ service: route.service, pickup: route.pickup, dropoff: route.dropoff });
    setStep(1);
    go("m-quote");
  }

  function stepOneError() {
    const result = validateQuote(toInput({ ...current, passengers: 1, luggage: 0 }, FILLER));
    return result.ok ? "" : result.message;
  }

  function stepTwoError() {
    const result = validateQuote(toInput(current, FILLER));
    if (result.ok) return "";
    if (/full name|email|Did you mean|digits|contact you/i.test(result.message)) return "";
    return result.message;
  }

  async function submit() {
    const input = toInput(current, contact);
    const validated = validateQuote(input);
    if (!validated.ok) {
      setError(validated.message);
      setNotice("");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (data && typeof data.url === "string" && data.url.startsWith("https://checkout.stripe.com/")) {
        window.location.assign(data.url);
        return;
      }
      setQuoteId(typeof data.quoteId === "string" ? data.quoteId : "");
      setNotice(data && data.message ? data.message : "The quote could not be saved.");
    } catch {
      setNotice("The quote could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const ideas = PLACES.filter((place) => place.toLowerCase().includes((suggest === "pickup" ? current.pickup : current.dropoff).trim().toLowerCase())).slice(0, 4);
  const payLabel = price.status === "quoted" && price.usd != null ? `Pay ${money(price.usd)} securely` : "Submit quote request";

  return (
    <div className="mobile-home">
      <header className="m-nav" data-section="nav">
        <a href="#m-hero" aria-label="Transport in Paris" onClick={(event) => { event.preventDefault(); go("m-hero"); }}><Logo /></a>
        <button className="m-iconBtn" type="button" aria-expanded={menu} aria-label="Menu" onClick={() => setMenu((open) => !open)}>
          <img src="/icons/menu.svg" alt="" width={24} height={24} />
        </button>
        {menu ? (
          <nav className="m-menu">
            <a href="#m-services" onClick={(event) => { event.preventDefault(); go("m-services"); }}>Services</a>
            <a href="#m-fleet" onClick={(event) => { event.preventDefault(); go("m-fleet"); }}>Fleet</a>
            <a href="#m-routes" onClick={(event) => { event.preventDefault(); go("m-routes"); }}>Routes</a>
            <a href="#m-reviews" onClick={(event) => { event.preventDefault(); go("m-reviews"); }}>Reviews</a>
            <a href="#m-faq" onClick={(event) => { event.preventDefault(); go("m-faq"); }}>FAQ</a>
            <a href="#m-quote" onClick={(event) => { event.preventDefault(); go("m-quote"); }}>Get my quote</a>
          </nav>
        ) : null}
      </header>

      <section className="m-hero" id="m-hero" data-section="hero">
        <div className="m-heroMedia" aria-hidden="true">
          <div className="m-heroWash" />
          <Picture src="/images/hero.jpg" alt="" priority />
          <div className="m-heroTint" />
        </div>
        <p className="m-pill">Christmas & New Year 2026 — booking open</p>
        <p className="m-greenPill">Free Printemps VIP Shopping Pass</p>
        <h1>Paris Made Effortless</h1>
        <p className="m-lead">Private airport transfers &amp; chauffeurs for North American travelers. Fixed price in USD, English-speaking drivers, we track your flight.</p>
        <div className="m-stack">
          <a className="m-btn" href="#m-quote" onClick={(event) => { event.preventDefault(); go("m-quote"); }}>Book Now !</a>
          <a className="m-btn m-btnLight" href={SMS}><img src="/icons/sms.svg" alt="" width={20} height={20} />Text us</a>
        </div>
        <p className="m-checks"><span>✓ Fixed price</span><span>✓ English-speaking</span><span>✓ Flight tracking</span></p>
      </section>

      <section className="m-section" id="m-services" data-section="services">
        <h2>How can we help in Paris?</h2>
        <button className="m-service" type="button" onClick={() => { patchTrip({ service: "airport" }); go("m-quote"); }}>
          <span className="m-serviceThumb"><Picture src="/images/service-airport.jpg" alt="Chauffeur beside a black van at the airport" /></span>
          <span><strong>Airport Transfer</strong><p>CDG, Orly, Beauvais ↔ hotel or Airbnb.</p><em>from $120  ·  Learn more →</em></span>
        </button>
        <button className="m-service" type="button" onClick={() => { patchTrip({ service: "hourly" }); go("m-quote"); }}>
          <span className="m-serviceThumb"><Picture src="/images/service-chauffeur.jpg" alt="Travelers with a chauffeur near the Eiffel Tower" /></span>
          <span><strong>Private Chauffeur</strong><p>Hourly driver — dinners, shopping, evenings.</p><em>from $350  ·  Learn more →</em></span>
        </button>
        <button className="m-service" type="button" onClick={() => { patchTrip({ service: "private" }); go("m-quote"); }}>
          <span className="m-serviceThumb"><Picture src="/images/service-trip.jpg" alt="Travelers beside a van at the Arc de Triomphe" /></span>
          <span><strong>Private Trip</strong><p>Versailles, Normandy, Champagne, Disneyland.</p><em>from $450  ·  Learn more →</em></span>
        </button>
        <div className="m-meet">
          <strong>Meet & Greet at CDG</strong>
          <p>1. Your driver tracks your flight and waits inside arrivals with a name sign.</p>
          <p>2. 60 min free waiting after landing — no extra charge if your flight is late.</p>
          <p>3. Terminal guide for 2E, 2F and 1 sent by text before you land.</p>
        </div>
      </section>

      <section className="m-section m-fleet" id="m-fleet" data-section="fleet">
        <h2>Choose your vehicle</h2>
        <p className="m-ribbon">Peak season, book early now !</p>
        <div className="m-fleetList">
          {FLEET.map((item) => {
            const selected = item.id === vehicleId;
            return (
              <article
                className={selected ? "m-fleetCard isOn" : "m-fleetCard"}
                key={item.id}
                onClick={() => { setVehicleId(item.id); setError(""); }}
              >
                <div className="m-fleetPhoto"><Picture src={item.image} alt={item.alt} /></div>
                <div className="m-fleetBody">
                  <div className="m-badges">{item.badges.map((badge) => <span key={badge}>{badge}</span>)}</div>
                  <p className="m-priceLine"><small>from</small><s>{money(item.priorPrice)}</s><b>{money(item.fromPrice)}</b><span className="m-per">/ transfer</span></p>
                  <div className="m-fleetCopy">
                    <p className="m-cap"><span>Pax: {item.pax}</span><span>Bags: {item.bags}</span></p>
                    <h3>{item.name}</h3>
                    <p className="m-model">{item.model}</p>
                  </div>
                  <div className="m-fleetActions">
                    <span className="m-save">Save ${item.priorPrice - item.fromPrice}</span>
                    {selected ? <span className="m-selected">✓ Selected</span> : <button className="m-select" type="button" onClick={(event) => { event.stopPropagation(); setVehicleId(item.id); setError(""); }}>Select</button>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="m-section m-holiday" data-section="holiday">
        <h2>Holiday slots are limited Nov–Dec</h2>
        <p>Peak dates sell out first — book early for Christmas & New Year.</p>
        <div className="m-chips"><span>Peak: Dec 24–26</span><span>Dec 31–Jan 1</span></div>
        <button className="m-btn" type="button" onClick={() => go("m-quote")}>Check availability</button>
      </section>

      <section className="m-section m-printemps" id="m-printemps" data-section="printemps">
        <div className="m-greenBar" />
        <p className="m-exclusive">Exclusive offers</p>
        <h2>Your ride comes with a VIP shopping day at Printemps Haussmann</h2>
        <div className="m-photoStrip">
          <Picture src="/images/printemps-club.jpg" alt="Le Club Printemps campaign" />
          <Picture src="/images/printemps-fashion.jpg" alt="Printemps fashion look" />
        </div>
        <div className="m-logoCard">
          <div className="m-wordmark"><Picture src="/images/printemps-wordmark.png" alt="Printemps" /></div>
          <div>
            <span className="m-club">Le Club Printemps</span>
            <strong>Printemps Haussmann · 64 bd Haussmann</strong>
            <span className="m-invite">One invitation per passenger</span>
          </div>
        </div>
        <div className="m-benefits">
          <div className="m-benefit m-b1"><i>✦</i>Access to our private lounges</div>
          <div className="m-benefit m-b2"><i aria-hidden="true"><img src="/icons/printemps-fingerprint.svg" alt="" width={24} height={24} /></i>Personal Shopping by appointment</div>
          <div className="m-benefit m-b3"><i>%</i>A 5% saving on eligible purchases*</div>
          <div className="m-benefit m-b4"><i>↺</i>Priority Tax Refund at the Salon Personal Shopping</div>
        </div>
        <p className="m-fine">*One-time offer upon subscription to the Printemps loyalty program.</p>
        <div className="m-fineCard">
          <button className="m-fineHead" type="button" aria-expanded={fineOpen} onClick={() => setFineOpen((open) => !open)}>
            Fine print & how to redeem <span>{fineOpen ? "–" : "+"}</span>
          </button>
          {fineOpen ? (
            <>
              <p>Show your invitation at the Printemps Salon, 4th floor, Women’s store. Valid until 31 Dec 2026; some exclusions may apply.</p>
              <p className="m-ux">UX: tap + to expand full terms (48h Personal Shopping booking, Club Printemps, opening hours).</p>
            </>
          ) : null}
        </div>
        <button className="m-btn" type="button" onClick={() => go("m-quote")}>Get Exclusive Offer</button>
      </section>

      <section className="m-section m-uber" id="m-compare" data-section="compare">
        <h2>Uber vs transportinparis from CDG</h2>
        <p>What most US travelers wish they knew before landing.</p>
        <div className="m-table">
          <div className="m-row">
            <div className="m-cell">Airport → Paris</div>
            <div className="m-cell m-uberCell"><strong>Uber / rideshare</strong></div>
            <div className="m-headTip">
              <Logo dark />
              <span className="m-rec">Recommended</span>
              <p><span className="m-stars">★★★★★</span> <span className="m-score">5.0</span></p>
            </div>
          </div>
          {COMPARE.map((row) => (
            <div className="m-row" key={row[0]}>
              <div className="m-cell m-feature">{row[0]}</div>
              <div className="m-cell m-uberCell"><b className="m-x">✕</b> {row[1]}</div>
              <div className="m-cell m-us"><b className="m-ok">✓</b> {row[2]}</div>
            </div>
          ))}
          <div className="m-winner" aria-hidden="true" />
        </div>
        <div className="m-why">
          <strong>Why it matters at the airport</strong>
          <p>• Rideshare apps work well in the city — CDG and Orly can be confusing for first-time visitors from North America.</p>
          <p>• Surge pricing on Christmas Eve or New Year’s Eve can raise fares a lot.</p>
          <p>• Families with lots of luggage often have to split into several cars.</p>
          <p>• transportinparis = fixed price + pickup inside + free waiting if you’re delayed.</p>
        </div>
        <div className="m-callout">
          <strong>Flying into Beauvais (BVA)?</strong>
          <p>About 85 km from Paris — rideshare pickups there are rare and pricey. transportinparis is usually the simpler option.</p>
          <button className="m-textBtn" type="button" onClick={() => { setFilter("Beauvais"); go("m-routes"); }}>See Beauvais route →</button>
        </div>
        <button className="m-btn" type="button" onClick={() => go("m-quote")}>Book Fixed-price Now</button>
      </section>

      <section className="m-section m-videos" id="m-reviews" data-section="reviews">
        <h2>Real travelers. Real holiday arrivals.</h2>
        <p>Hear from families and couples from the US & Canada.</p>
        <div className="m-scroller" onScroll={(event) => {
          const left = event.currentTarget.scrollLeft;
          setDot(Math.round(left / 232));
        }}>
          {REVIEWS.map((review) => (
            <article className="m-videoCard" key={review.id}>
              {playing === review.id ? (
                <video className="m-poster" controls autoPlay playsInline src={review.video} />
              ) : (
                <button className="m-poster" type="button" aria-label={`Play review from ${review.name}`} onClick={() => setPlaying(review.id)}>
                  <video className="m-still" ref={showStill} src={`${review.video}#t=0.4`} muted playsInline preload="auto" tabIndex={-1} aria-hidden="true" />
                  {review.duration ? <span className="m-ccRow"><span className="m-cc">CC EN</span><span className="m-dur">{review.duration}</span></span> : null}
                  <img className="m-play" src="/icons/play.svg" alt="" width={48} height={48} />
                  <span className="m-quoteOverlay">“{review.quote}”</span>
                </button>
              )}
              <p className="m-stars">★★★★★</p>
              <strong>{review.name}</strong>
              <small>{review.trip}</small>
            </article>
          ))}
        </div>
        <div className="m-dots" aria-hidden="true">{[0, 1, 2].map((index) => <i key={index} className={dot === index ? "isOn" : ""} />)}</div>
        <button className="m-btn" type="button" onClick={() => go("m-quote")}>Book Now !</button>
      </section>

      <section className="m-section m-routes" id="m-routes" data-section="routes">
        <h2>Main routes from Paris</h2>
        <div className="m-filters" role="tablist">
          {FILTERS.map((item) => (
            <button key={item} type="button" className={filter === item ? "isOn" : ""} onClick={() => setFilter(item)}>{item}</button>
          ))}
        </div>
        <div className="m-routeList">
          {shownRoutes.map((route) => (
            <article className="m-route" key={route.id}>
              <div className="m-routeTop">
                <div className="m-routeThumb"><Picture src={route.thumb} alt={route.alt} /></div>
                <div className="m-routeCopy">
                  <h3>{route.title}</h3>
                  <p className="m-routeMeta">{route.meta}</p>
                </div>
              </div>
              <p className="m-fares">Compact SUV $120 · Premium Van $170 · Big Van $280 · Save $50</p>
              <ul>{route.bullets.map((bullet) => <li key={bullet}>• {bullet}</li>)}</ul>
              <button className="m-btn" type="button" onClick={() => bookRoute(route)}>Book this route</button>
            </article>
          ))}
        </div>
      </section>

      <section className="m-section m-quote" id="m-quote" data-section="quote">
        <h2>Get my fixed-price quote</h2>
        <p className="m-sub">3 quick steps. See your fixed price after step 1.</p>
        <form className="m-card" onSubmit={(event) => { event.preventDefault(); if (step === 1) { const message = stepOneError(); if (message) setError(message); else { setError(""); setStep(2); } } else if (step === 2) { const message = stepTwoError(); if (message) setError(message); else { setError(""); setStep(3); } } else void submit(); }}>
          <div className="m-progress" aria-hidden="true">{[1, 2, 3].map((index) => <i key={index} className={step >= index ? "isOn" : ""} />)}</div>
          <div className="m-steps">
            <span className={step === 1 ? "isOn" : ""}>{step > 1 ? "✓ Trip" : "1 Trip"}</span>
            <span className={step === 2 ? "isOn" : ""}>{step > 2 ? "✓ Details" : "2 Details"}</span>
            <span className={step === 3 ? "isOn" : ""}>3 Contact</span>
          </div>

          {step === 1 ? (
            <>
              <h3>Plan your ride</h3>
              <label className="m-field"><span>Service type</span>
                <div className="m-choice">
                  {[["airport", "Airport"], ["private", "Private trip"], ["hourly", "Hourly"]].map(([id, label]) => (
                    <button key={id} type="button" className={current.service === id ? "isOn" : ""} onClick={() => patchTrip({ service: id })}>{label}</button>
                  ))}
                </div>
              </label>
              <div className="m-field"><span className="m-label">Trip</span>
                <div className="m-choice">
                  <button type="button" className={current.tripType === "oneway" ? "isOn" : ""} onClick={() => patchTrip({ tripType: "oneway" })}>One Way</button>
                  <button type="button" className={current.tripType === "return" ? "isOn" : ""} onClick={() => patchTrip({ tripType: "return" })}>Return</button>
                </div>
              </div>
              <label className="m-field"><span>Pickup *</span>
                <input className="m-input" value={current.pickup} placeholder="Airport, port or address" autoComplete="off" onFocus={() => setSuggest("pickup")} onChange={(event) => { patchTrip({ pickup: event.target.value }); setSuggest("pickup"); }} />
              </label>
              {suggest === "pickup" && ideas.length ? (
                <div className="m-suggest"><p>SUGGESTED</p>{ideas.map((place) => <button key={place} type="button" onClick={() => { patchTrip({ pickup: place }); setSuggest(""); }}>{place}<small>Suggested stop</small></button>)}</div>
              ) : null}
              <label className="m-field"><span>Drop-off *</span>
                <input className="m-input" value={current.dropoff} placeholder="Airport, port or address" autoComplete="off" onFocus={() => setSuggest("dropoff")} onChange={(event) => { patchTrip({ dropoff: event.target.value }); setSuggest("dropoff"); }} />
              </label>
              {suggest === "dropoff" && ideas.length ? (
                <div className="m-suggest"><p>SUGGESTED</p>{ideas.map((place) => <button key={place} type="button" onClick={() => { patchTrip({ dropoff: place }); setSuggest(""); }}>{place}<small>Suggested stop</small></button>)}</div>
              ) : null}
              <div className="m-split">
                <label className="m-field m-grow"><span>Date *</span>
                  <input className="m-input" inputMode="numeric" placeholder="MM/DD/YYYY" value={current.date} onChange={(event) => patchTrip({ date: event.target.value })} />
                </label>
                <label className="m-field m-grow"><span>Time *</span>
                  <select className="m-input" value={current.time} onChange={(event) => patchTrip({ time: event.target.value })}>
                    <option value="">hh:mm AM/PM</option>
                    {TIMES.map((time) => <option key={time} value={time}>{time}</option>)}
                  </select>
                </label>
              </div>
              {current.tripType === "return" ? (
                <div className="m-split">
                  <label className="m-field m-grow"><span>Return date *</span>
                    <input className="m-input" inputMode="numeric" placeholder="MM/DD/YYYY" value={current.returnDate} onChange={(event) => patchTrip({ returnDate: event.target.value })} />
                  </label>
                  <label className="m-field m-grow"><span>Return time *</span>
                    <select className="m-input" value={current.returnTime} onChange={(event) => patchTrip({ returnTime: event.target.value })}>
                      <option value="">hh:mm AM/PM</option>
                      {TIMES.map((time) => <option key={time} value={time}>{time}</option>)}
                    </select>
                  </label>
                </div>
              ) : null}
              {peak(current.date) ? <p className="m-demand">High demand</p> : null}
              <p className="m-help">Calendar picker · 15-min time slots · “High demand” label on Christmas & New Year dates</p>
              {error ? <p className="m-error" role="alert">{error}</p> : null}
              <button className="m-btn" type="submit">See my price</button>
              <p className="m-chat">Questions? <a href={SMS}>Chat with us</a></p>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="m-priceBox">
                <header><span>Your fixed price</span><strong>{price.status === "quoted" && price.usd != null ? money(price.usd) : "We'll confirm"}</strong></header>
                <p>{current.pickup || "Pickup"} → {current.dropoff || "Drop-off"} · {current.date} · {current.time}</p>
                <p>All-inclusive: tolls, waiting time, luggage. No surge.</p>
              </div>
              <h3>Passengers & luggage</h3>
              <div className="m-split">
                <div className="m-field m-grow"><span>Passengers *</span>
                  <div className="m-stepper">
                    <button type="button" aria-label="Fewer passengers" onClick={() => patchTrip({ passengers: Math.max(1, current.passengers - 1) })}>–</button>
                    <b>{current.passengers}</b>
                    <button type="button" aria-label="More passengers" onClick={() => patchTrip({ passengers: Math.min(16, current.passengers + 1) })}>+</button>
                  </div>
                </div>
                <div className="m-field m-grow"><span>Luggage pieces</span>
                  <div className="m-stepper">
                    <button type="button" aria-label="Less luggage" onClick={() => patchTrip({ luggage: Math.max(0, current.luggage - 1) })}>–</button>
                    <b>{current.luggage}</b>
                    <button type="button" aria-label="More luggage" onClick={() => patchTrip({ luggage: Math.min(16, current.luggage + 1) })}>+</button>
                  </div>
                </div>
              </div>
              <p className="m-help">One Printemps VIP Shopping Pass per passenger</p>
              <div className="m-field"><span>Vehicle <em className="m-tag">AUTO</em></span>
                <div className="m-auto">
                  <strong>{vehicle.name}</strong>
                  <button className="m-textBtn" type="button" onClick={() => go("m-fleet")}>Change</button>
                  <small>Matched to {current.passengers} pax · {current.luggage} luggage pieces</small>
                </div>
              </div>
              {current.service === "airport" ? (
                <label className="m-field"><span>Flight number <em className="m-tag">AIRPORT ONLY</em></span>
                  <input className="m-input" placeholder="e.g. AF 011" value={current.flight} onChange={(event) => patchTrip({ flight: event.target.value })} />
                  <small className="m-help">Optional. We track your flight and can fill date & time from it.</small>
                </label>
              ) : null}
              <button className="m-textBtn" type="button" onClick={() => setNotesOpen((open) => !open)}>{notesOpen ? "Hide notes" : "Add notes"}</button>
              {notesOpen ? <textarea placeholder="Child seat ages, extra stops…" value={current.notes} onChange={(event) => patchTrip({ notes: event.target.value })} /> : null}
              <div className="m-pass"><span aria-hidden="true">🎁</span><span><strong>{current.passengers} Printemps VIP {current.passengers === 1 ? "pass" : "passes"} included</strong><br />1 per passenger · updates with the Passengers count</span></div>
              {error ? <p className="m-error" role="alert">{error}</p> : null}
              <button className="m-btn" type="submit">Continue</button>
              <button className="m-textBtn" type="button" onClick={() => { setError(""); setStep(1); }}>Back</button>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div className="m-summary">
                <header><strong>Your trip</strong><button type="button" onClick={() => { setError(""); setStep(1); }}>Edit</button></header>
                <div><span>Route</span><span>{current.pickup} → {current.dropoff}</span></div>
                <div><span>Date</span><span>{current.date} · {current.time}</span></div>
                <div><span>Vehicle</span><span>{vehicle.name}</span></div>
                <div><span>Fixed price</span><strong>{price.status === "quoted" && price.usd != null ? money(price.usd) : "We'll confirm"}</strong></div>
                <p>🎁 {current.passengers} Printemps VIP {current.passengers === 1 ? "pass" : "passes"} included</p>
              </div>
              <h3>Your contact details</h3>
              <label className="m-field"><span>Full name *</span>
                <input className="m-input" placeholder="Jane Doe" value={contact.name} onChange={(event) => setContact({ ...contact, name: event.target.value })} />
              </label>
              <label className="m-field"><span>Email *</span>
                <input className="m-input" type="email" placeholder="jane.doe@gmail.com" value={contact.email} onBlur={() => { const result = validateQuote(toInput(current, { ...FILLER, email: contact.email, name: contact.name || FILLER.name })); if (!result.ok && /email|Did you mean/i.test(result.message)) setError(result.message); }} onChange={(event) => { setContact({ ...contact, email: event.target.value }); setError(""); }} />
              </label>
              <label className="m-field"><span>Mobile number *</span>
                <span className="m-phone"><span className="m-ccode">🇺🇸 +1</span>
                  <input className="m-input" inputMode="tel" placeholder="(212) 555-0147" value={contact.mobile} onBlur={() => { const result = validateQuote(toInput(current, { ...contact, name: contact.name || FILLER.name, email: contact.email || FILLER.email })); if (!result.ok && /digits/i.test(result.message)) setError(result.message); }} onChange={(event) => { setContact({ ...contact, mobile: formatPhone(event.target.value) }); setError(""); }} />
                </span>
                <small className="m-help">Auto-formatted for +1</small>
              </label>
              <div className="m-field"><span>How should we contact you?</span>
                <div className="m-seg">
                  {[["text", "Text"], ["email", "Email"], ["whatsapp", "WhatsApp"]].map(([id, label]) => (
                    <button key={id} type="button" className={contact.contactPref === id ? "isOn" : ""} onClick={() => setContact({ ...contact, contactPref: id })}>{label}</button>
                  ))}
                </div>
              </div>
              {error ? <p className="m-error" role="alert">{error}</p> : null}
              {notice ? <p className="m-okMsg" data-quote-id={quoteId}>{notice}{quoteId ? ` Quote ${quoteId}.` : ""}</p> : null}
              <button className="m-btn" type="submit" disabled={busy}>{busy ? "Saving…" : payLabel}</button>
              <p className="m-trust">Free cancellation up to 24h · No surge · Stripe</p>
              <p className="m-chat">Questions? <a href={SMS}>Chat with us</a></p>
              <button className="m-textBtn" type="button" onClick={() => { setError(""); setStep(2); }}>Back</button>
            </>
          ) : null}
        </form>
      </section>

      <section className="m-section m-faq" id="m-faq" data-section="faq">
        <h2>FAQ</h2>
        {FAQ.map((item, index) => {
          const open = openFaq.includes(index);
          return (
            <button className="m-faqItem" type="button" key={item.q} aria-expanded={open} onClick={() => setOpenFaq((list) => open ? list.filter((value) => value !== index) : [...list, index])}>
              <span><i>{open ? "–" : "+"}</i>{item.q}</span>
              {open ? <p>{item.a}</p> : null}
            </button>
          );
        })}
      </section>

      <footer className="m-footer" data-section="footer">
        <Logo dark />
        <h2>English support 7 days a week</h2>
        <p>Text/Call +1 (332) 296-1375 · bonjour@transportinparis.com</p>
        <a className="m-btn" href={SMS}><img src="/icons/sms.svg" alt="" width={20} height={20} />Text us</a>
        <a className="m-btn" href="#m-quote" onClick={(event) => { event.preventDefault(); go("m-quote"); }}>Book Now</a>
        <p className="m-secure">🔒 Secure payment</p>
        <div className="m-pays">
          <img src="/pay/visa.svg" alt="Visa" width={48} height={30} />
          <img src="/pay/mastercard.svg" alt="Mastercard" width={48} height={30} />
          <img src="/pay/amex.svg" alt="American Express" width={48} height={30} />
          <img src="/pay/stripe.svg" alt="Stripe" width={48} height={30} />
          <img src="/pay/apple-pay.svg" alt="Apple Pay" width={48} height={30} />
          <img src="/pay/google-pay.svg" alt="Google Pay" width={48} height={30} />
        </div>
        <hr />
        <p className="m-routesLabel">Routes</p>
        <p className="m-routeLine">CDG airport transfer · Orly transfer · Beauvais transfer · Disneyland Paris · Versailles trip · Normandy day trip · Champagne day trip</p>
        <p className="m-copy">© 2026 transportinparis.com · Terms · Cancellation · Privacy</p>
      </footer>
    </div>
  );
}

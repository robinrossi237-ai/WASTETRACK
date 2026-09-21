import { useEffect, useState } from "react";
import { Quote, Star, Home, Truck } from "lucide-react";
import { useLanguage } from "../lib/i18n";
import Reveal from "./Reveal";

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ||
  "https://wastetrack-api-juki.onrender.com/api";

type RemoteTestimonial = {
  author: string;
  role: string | null;
  area: string | null;
  rating: number;
  message: string;
  created_at: string;
};

type Card = {
  key: string;
  quote: string;
  name: string;
  role: string;
  rating: number;
};

const CARD_STYLES = [
  { icon: Home, color: "bg-brand-100 text-brand-700" },
  { icon: Truck, color: "bg-sky-100 text-sky-700" },
  { icon: Star, color: "bg-amber-100 text-amber-700" },
];

export default function Testimonials() {
  const { t, lang } = useLanguage();
  const [remote, setRemote] = useState<RemoteTestimonial[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/content/testimonials?limit=6`);
        if (!res.ok) return;
        const data = (await res.json()) as { success: boolean; testimonials: RemoteTestimonial[] };
        if (!cancelled && data.success && Array.isArray(data.testimonials) && data.testimonials.length > 0) {
          setRemote(data.testimonials);
        }
      } catch {
        // Silent: fall back to built-in testimonials.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const roleLabel = (role: string | null) =>
    role === "collector" ? (lang === "fr" ? "Collecteur" : "Collector") : lang === "fr" ? "Résident" : "Resident";

  const testimonials: Card[] =
    remote !== null
      ? remote.map((item, index) => ({
          key: `${item.author}-${index}`,
          quote: item.message,
          name: item.author,
          role: [roleLabel(item.role), item.area].filter(Boolean).join(" · "),
          rating: Math.min(5, Math.max(1, item.rating)),
        }))
      : [
          { key: "mock-1", quote: t("testi.q1"), name: t("testi.n1"), role: t("testi.r1"), rating: 5 },
          { key: "mock-2", quote: t("testi.q2"), name: t("testi.n2"), role: t("testi.r2"), rating: 5 },
          { key: "mock-3", quote: t("testi.q3"), name: t("testi.n3"), role: t("testi.r3"), rating: 5 },
        ];

  return (
    <section id="temoignages" className="bg-slate-50 py-20 sm:py-24">
      <div className="container-page">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="chip">{t("testi.chip")}</span>
          <h2 className="section-title mt-4">{t("testi.title")}</h2>
          <p className="section-subtitle">{t("testi.subtitle")}</p>
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => {
            const style = CARD_STYLES[index % CARD_STYLES.length];
            const Icon = style.icon;
            return (
              <Reveal key={testimonial.key} delay={index * 120}>
                <figure className="group flex flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-soft transition duration-300 hover:-translate-y-1.5 hover:border-brand-200 hover:shadow-lg">
                  <Quote className="h-7 w-7 text-brand-300 transition-transform duration-300 group-hover:scale-110" />
                  <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-slate-600">
                    « {testimonial.quote} »
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-5">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-full ${style.color}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{testimonial.name}</p>
                      <p className="text-xs text-slate-500">{testimonial.role}</p>
                    </div>
                    <div className="ml-auto flex gap-0.5" aria-label={`${testimonial.rating}/5`}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${
                            i < testimonial.rating
                              ? "fill-amber-400 text-amber-400"
                              : "fill-slate-200 text-slate-200"
                          }`}
                        />
                      ))}
                    </div>
                  </figcaption>
                </figure>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

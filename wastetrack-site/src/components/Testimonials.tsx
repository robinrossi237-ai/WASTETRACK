import { Quote, Star, Home, Truck } from "lucide-react";
import { useLanguage } from "../lib/i18n";
import Reveal from "./Reveal";

export default function Testimonials() {
  const { t } = useLanguage();

  const testimonials = [
    {
      quote: t("testi.q1"),
      name: t("testi.n1"),
      role: t("testi.r1"),
      icon: Home,
      color: "bg-brand-100 text-brand-700",
    },
    {
      quote: t("testi.q2"),
      name: t("testi.n2"),
      role: t("testi.r2"),
      icon: Truck,
      color: "bg-sky-100 text-sky-700",
    },
    {
      quote: t("testi.q3"),
      name: t("testi.n3"),
      role: t("testi.r3"),
      icon: Star,
      color: "bg-amber-100 text-amber-700",
    },
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
          {testimonials.map((testimonial, index) => (
            <Reveal key={testimonial.name} delay={index * 120}>
              <figure className="group flex flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-soft transition duration-300 hover:-translate-y-1.5 hover:border-brand-200 hover:shadow-lg">
                <Quote className="h-7 w-7 text-brand-300 transition-transform duration-300 group-hover:scale-110" />
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-slate-600">
                  « {testimonial.quote} »
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-5">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-full ${testimonial.color}`}>
                    <testimonial.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{testimonial.name}</p>
                    <p className="text-xs text-slate-500">{testimonial.role}</p>
                  </div>
                  <div className="ml-auto flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
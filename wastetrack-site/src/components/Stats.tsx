import { MoveUpRight } from "lucide-react";
import { useLanguage } from "../lib/i18n";
import Reveal from "./Reveal";
import CountUp from "./CountUp";

export default function Stats() {
  const { t } = useLanguage();

  const stats = [
    { value: 1200, suffix: "+", label: t("stats.s1"), suffixLabel: t("stats.s1.suffix") },
    { value: 85, suffix: " %", label: t("stats.s2"), suffixLabel: t("stats.s2.suffix") },
    { value: 3500, suffix: "", label: t("stats.s3"), suffixLabel: t("stats.s3.suffix") },
    { value: 1000, suffix: "+", label: t("stats.s4"), suffixLabel: t("stats.s4.suffix") },
  ];

  return (
    <section id="impact" className="bg-white py-20 sm:py-24">
      <div className="container-page">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="chip">{t("stats.chip")}</span>
          <h2 className="section-title mt-4">{t("stats.title")}</h2>
          <p className="section-subtitle">{t("stats.subtitle")}</p>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <Reveal key={stat.label} delay={index * 100}>
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-soft transition duration-300 hover:-translate-y-1.5 hover:shadow-lg hover:shadow-brand-600/20">
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full border-2 border-white/15 transition-transform duration-500 group-hover:scale-125" />
                <div className="flex items-center justify-between">
                  <p className="text-4xl font-extrabold tracking-tight">
                    <CountUp value={stat.value} suffix={stat.suffix} />
                  </p>
                  <MoveUpRight className="h-5 w-5 text-brand-200 opacity-70 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
                </div>
                <p className="mt-3 text-sm font-semibold text-white/90">{stat.label}</p>
                <p className="mt-1 text-xs text-white/60">{stat.suffixLabel}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
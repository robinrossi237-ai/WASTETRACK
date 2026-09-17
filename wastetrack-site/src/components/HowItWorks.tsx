import { ClipboardList, Radar, Gift } from "lucide-react";
import { useLanguage } from "../lib/i18n";
import Reveal from "./Reveal";

export default function HowItWorks() {
  const { t } = useLanguage();

  const steps = [
    {
      icon: ClipboardList,
      title: t("how.s1.title"),
      description: t("how.s1.desc"),
      color: "bg-brand-100 text-brand-700",
    },
    {
      icon: Radar,
      title: t("how.s2.title"),
      description: t("how.s2.desc"),
      color: "bg-sky-100 text-sky-700",
    },
    {
      icon: Gift,
      title: t("how.s3.title"),
      description: t("how.s3.desc"),
      color: "bg-amber-100 text-amber-700",
    },
  ];

  return (
    <section id="comment-ca-marche" className="bg-white py-20 sm:py-24">
      <div className="container-page">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="chip">{t("how.chip")}</span>
          <h2 className="section-title mt-4">{t("how.title")}</h2>
          <p className="section-subtitle">{t("how.subtitle")}</p>
        </Reveal>

        <div className="relative mt-14 grid gap-8 md:grid-cols-3">
          <div className="pointer-events-none absolute left-1/2 top-12 hidden h-0.5 w-2/3 -translate-x-1/2 bg-gradient-to-r from-brand-200 via-sky-200 to-amber-200 md:block" />
          {steps.map((step, index) => (
            <Reveal key={step.title} delay={index * 130}>
              <div className="group relative text-center md:text-left">
                <div className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl shadow-soft transition-transform duration-300 group-hover:-translate-y-1 md:mx-0">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105 ${step.color}`}>
                    <step.icon className="h-7 w-7" />
                  </div>
                  <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white transition-transform duration-300 group-hover:scale-110">
                    {index + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-900">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-slate-500">{step.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
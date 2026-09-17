import { Trash2, Navigation, TriangleAlert, CalendarClock, Languages, BellRing } from "lucide-react";
import { useLanguage } from "../lib/i18n";
import Reveal from "./Reveal";

export default function Features() {
  const { t } = useLanguage();

  const features = [
    {
      icon: Trash2,
      title: t("feature.f1.title"),
      description: t("feature.f1.desc"),
      color: "bg-brand-100 text-brand-700",
    },
    {
      icon: CalendarClock,
      title: t("feature.f2.title"),
      description: t("feature.f2.desc"),
      color: "bg-sky-100 text-sky-700",
    },
    {
      icon: Navigation,
      title: t("feature.f3.title"),
      description: t("feature.f3.desc"),
      color: "bg-brand-100 text-brand-700",
    },
    {
      icon: TriangleAlert,
      title: t("feature.f4.title"),
      description: t("feature.f4.desc"),
      color: "bg-amber-100 text-amber-700",
    },
    {
      icon: BellRing,
      title: t("feature.f5.title"),
      description: t("feature.f5.desc"),
      color: "bg-rose-100 text-rose-700",
    },
    {
      icon: Languages,
      title: t("feature.f6.title"),
      description: t("feature.f6.desc"),
      color: "bg-indigo-100 text-indigo-700",
    },
  ];

  return (
    <section id="fonctionnalites" className="bg-slate-50 py-20 sm:py-24">
      <div className="container-page">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="chip">{t("feature.chip")}</span>
          <h2 className="section-title mt-4">{t("feature.title")}</h2>
          <p className="section-subtitle">{t("feature.subtitle")}</p>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Reveal key={feature.title} delay={(index % 3) * 110}>
              <div className="group rounded-2xl border border-slate-100 bg-white p-6 shadow-soft transition duration-300 hover:-translate-y-1.5 hover:border-brand-200 hover:shadow-lg">
                <div
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-110 ${feature.color}`}
                >
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{feature.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
import { useState } from "react";
import { Sparkles, Gift, Trophy, Check } from "lucide-react";
import { useLanguage } from "../lib/i18n";
import Reveal from "./Reveal";

export default function RewardsPlans() {
  const { t } = useLanguage();
  const [selected, setSelected] = useState("Plus");

  const rewards = [
    { points: "+50", label: t("plan.r1"), icon: Gift, color: "bg-brand-100 text-brand-700" },
    { points: "+20", label: t("plan.r2"), icon: Sparkles, color: "bg-sky-100 text-sky-700" },
    { points: "+100", label: t("plan.r3"), icon: Trophy, color: "bg-amber-100 text-amber-700" },
  ];

  const plans = [
    {
      name: t("plan.free.name"),
      price: t("plan.free.price"),
      period: t("plan.free.period"),
      description: t("plan.free.desc"),
      features: [t("plan.free.f1"), t("plan.free.f2"), t("plan.free.f3"), t("plan.free.f4")],
      featured: false,
      cta: t("plan.free.cta"),
    },
    {
      name: t("plan.plus.name"),
      price: t("plan.plus.price"),
      period: t("plan.plus.period"),
      description: t("plan.plus.desc"),
      features: [t("plan.plus.f1"), t("plan.plus.f2"), t("plan.plus.f3"), t("plan.plus.f4"), t("plan.plus.f5")],
      featured: true,
      cta: t("plan.plus.cta"),
    },
    {
      name: t("plan.pro.name"),
      price: t("plan.pro.price"),
      period: t("plan.pro.period"),
      description: t("plan.pro.desc"),
      features: [t("plan.pro.f1"), t("plan.pro.f2"), t("plan.pro.f3"), t("plan.pro.f4"), t("plan.pro.f5")],
      featured: false,
      cta: t("plan.pro.cta"),
    },
  ];

  return (
    <section id="plans" className="bg-white py-20 sm:py-24">
      <div className="container-page">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="chip">{t("plan.chip")}</span>
          <h2 className="section-title mt-4">{t("plan.title")}</h2>
          <p className="section-subtitle">{t("plan.subtitle")}</p>
        </Reveal>

        <div className="mx-auto mt-12 grid max-w-3xl gap-5 sm:grid-cols-3">
          {rewards.map((reward, index) => (
            <Reveal key={reward.label} delay={index * 100}>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition duration-300 hover:-translate-y-1 hover:border-brand-200">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${reward.color}`}
                >
                  <reward.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-lg font-extrabold text-brand-600">{reward.points}</p>
                  <p className="text-xs leading-snug text-slate-500">{reward.label}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <Reveal key={plan.name} delay={index * 120}>
              <div
                onClick={() => setSelected(plan.name)}
                className={`group relative h-full cursor-pointer rounded-3xl border p-7 transition duration-300 hover:-translate-y-1.5 ${
                  selected === plan.name
                    ? "border-brand-500 shadow-lg shadow-brand-600/10"
                    : "border-slate-200 hover:border-brand-200"
                } ${plan.featured ? "bg-brand-950 text-white" : "bg-white"}`}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-xs font-bold text-slate-900 shadow">
                    {t("plan.featured")}
                  </span>
                )}
                <h3 className={`text-lg font-bold ${plan.featured ? "text-white" : "text-slate-900"}`}>
                  {plan.name}
                </h3>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span
                    className={`text-3xl font-extrabold transition ${plan.featured ? "text-brand-300" : "text-slate-900"}`}
                  >
                    {plan.price}
                  </span>
                  <span className={`text-sm ${plan.featured ? "text-white/60" : "text-slate-400"}`}>
                    {plan.period}
                  </span>
                </div>
                <p className={`mt-2 text-sm leading-relaxed ${plan.featured ? "text-white/70" : "text-slate-500"}`}>
                  {plan.description}
                </p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check
                        className={`mt-0.5 h-4 w-4 shrink-0 ${plan.featured ? "text-brand-300" : "text-brand-600"}`}
                      />
                      <span className={`text-sm ${plan.featured ? "text-white/85" : "text-slate-600"}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelected(plan.name);
                    document.getElementById("telechargement")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className={`mt-7 w-full rounded-xl px-5 py-2.5 text-sm font-semibold transition duration-300 hover:-translate-y-0.5 ${
                    plan.featured
                      ? "bg-white text-brand-800 hover:bg-brand-50"
                      : "border border-brand-600 bg-brand-50 text-brand-700 hover:bg-brand-100"
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <p className="mt-6 text-center text-xs text-slate-400">{t("plan.note")}</p>
        </Reveal>
      </div>
    </section>
  );
}
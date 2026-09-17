import { Route, Inbox, Wallet, ShieldCheck, Share2, CheckCircle2 } from "lucide-react";
import { useLanguage } from "../lib/i18n";
import Reveal from "./Reveal";

export default function Collectors() {
  const { t } = useLanguage();

  const perks = [
    {
      icon: Inbox,
      title: t("collector.p1.title"),
      description: t("collector.p1.desc"),
    },
    {
      icon: Route,
      title: t("collector.p2.title"),
      description: t("collector.p2.desc"),
    },
    {
      icon: ShieldCheck,
      title: t("collector.p3.title"),
      description: t("collector.p3.desc"),
    },
    {
      icon: Wallet,
      title: t("collector.p4.title"),
      description: t("collector.p4.desc"),
    },
  ];

  const tourStats = [
    { label: t("collector.requests"), value: "128" },
    { label: t("collector.points"), value: "2 480" },
    { label: t("collector.rating"), value: "4,9 / 5" },
  ];

  return (
    <section id="collecteurs" className="relative overflow-hidden bg-brand-950 py-20 sm:py-24">
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 85%, white 1.5px, transparent 1.5px), radial-gradient(circle at 90% 15%, white 1.5px, transparent 1.5px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="container-page relative">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-300">
                <Share2 className="h-4 w-4" />
                {t("collector.badge")}
              </span>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {t("collector.title")}
              </h2>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-4 text-lg leading-relaxed text-white/75">{t("collector.subtitle")}</p>
            </Reveal>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {perks.map((perk, index) => (
                <Reveal key={perk.title} delay={200 + index * 90}>
                  <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition duration-300 hover:-translate-y-1 hover:border-brand-400/30 hover:bg-white/10">
                    <perk.icon className="h-6 w-6 text-brand-300 transition-transform duration-300 group-hover:scale-110" />
                    <h3 className="mt-3 text-base font-bold text-white">{perk.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/65">{perk.description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delay={120} direction="right">
            <div className="grid gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="text-sm font-semibold text-white/60">{t("collector.profileTitle")}</p>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-white/95 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 font-bold text-white">
                      TB
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Thierry B.</p>
                      <p className="text-xs text-slate-500">{t("collector.zone")}</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t("collector.available")}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {tourStats.map((stat) => (
                    <div key={stat.label} className="rounded-xl bg-white/90 p-3 text-center">
                      <p className="text-lg font-bold text-brand-700">{stat.value}</p>
                      <p className="text-[11px] font-medium text-slate-500">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white/60">{t("collector.tourTitle")}</p>
                  <span className="text-xs font-semibold text-brand-300">{t("collector.tourOptimized")}</span>
                </div>
                <div className="mt-4 space-y-3">
                  {["Bonanjo", "Akwa", "Bonapriso"].map((stop, index) => (
                    <div key={stop} className="flex items-center gap-3 rounded-xl bg-white/95 p-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-800">{stop}</p>
                        <p className="text-[11px] text-slate-500">{t("collector.pickupsCount")}</p>
                      </div>
                      <span className="text-xs font-semibold text-emerald-600">~ {9 + index * 2}h30</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
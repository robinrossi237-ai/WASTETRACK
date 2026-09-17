import {
  Recycle,
  Trash2,
  Download,
  ChevronDown,
  Layers,
  Home,
  Sparkles,
  Battery,
  Package,
} from "lucide-react";
import { useLanguage } from "../lib/i18n";
import Reveal from "./Reveal";
import Marquee from "./Marquee";

export default function Hero() {
  const { t, lang } = useLanguage();

  const stats = [
    { value: "10 min", label: t("hero.stat1") },
    { value: "1000+", label: t("hero.stat2") },
    { value: "3 000 pts", label: t("hero.stat3") },
  ];

  const marqueeItems = [
    { icon: Home, label: t("hero.marquee.household") },
    { icon: Package, label: t("hero.marquee.plastic") },
    { icon: Recycle, label: t("hero.marquee.recyclable") },
    { icon: Layers, label: t("hero.marquee.organic") },
    { icon: Battery, label: t("hero.marquee.electronic") },
    { icon: Sparkles, label: t("hero.marquee.bulky") },
  ];

  return (
    <section
      id="accueil"
      className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600"
    >
      <div
        className="pointer-events-none absolute inset-0 animate-gradient-x opacity-90"
        style={{
          backgroundImage:
            "linear-gradient(115deg, rgba(6,52,46,0) 0%, rgba(16,185,129,0.18) 35%, rgba(59,130,246,0.12) 55%, rgba(245,158,11,0.10) 75%, rgba(6,52,46,0) 100%)",
          backgroundSize: "220% 220%",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, white 1.5px, transparent 1.5px), radial-gradient(circle at 80% 70%, white 1.5px, transparent 1.5px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full border-2 border-white/20" />
      <div className="pointer-events-none absolute -bottom-56 -right-40 h-[30rem] w-[30rem] rounded-full border-2 border-white/15" />

      <div className="container-page relative pt-28 pb-20 sm:pt-32 lg:pt-36 lg:pb-28">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/90">
              <Recycle className="h-4 w-4 text-brand-300" />
              {t("hero.badge")}
            </div>

            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              {t("hero.titleA")}{" "}
              <span className="bg-gradient-to-r from-brand-300 to-emerald-200 bg-clip-text text-transparent">
                {t("hero.titleB")}
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/80">{t("hero.subtitle")}</p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#telechargement"
                className="btn-primary !bg-white !text-brand-800 transition-transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-white/20"
              >
                <Download className="h-4 w-4" />
                {t("hero.ctaPrimary")}
              </a>
              <a
                href="#comment-ca-marche"
                className="group inline-flex items-center gap-2 rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {t("hero.ctaSecondary")}
                <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
              </a>
            </div>

            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/15 bg-white/5 p-4 transition hover:-translate-y-1 hover:bg-white/10"
                >
                  <dt className="order-2 mt-1 block text-xs text-white/60">{stat.label}</dt>
                  <dd className="order-1 text-2xl font-bold text-white">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal delay={150} direction="right">
            <PhoneMockup langLabel={lang === "fr" ? "FR" : "EN"} collectorLabel={t("hero.mockup.collector")} />
          </Reveal>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <Marquee items={marqueeItems} />
      </div>
    </section>
  );
}

function PhoneMockup({ langLabel, collectorLabel }: { langLabel: string; collectorLabel: string }) {
  const { t } = useLanguage();
  return (
    <div className="relative mx-auto hidden max-w-sm sm:block">
      <div className="pointer-events-none absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-white/20 to-transparent blur-2xl" />
      <div className="relative rounded-[2.6rem] border border-white/20 bg-slate-900 p-3 shadow-2xl">
        <div className="rounded-[2rem] bg-white p-4">
          {/* Status bar */}
          <div className="flex items-center justify-between px-1 pb-3">
            <span className="text-xs font-bold text-slate-800">9:41</span>
            <WasteLogo />
            <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
              {langLabel}
            </span>
          </div>

          {/* Map area */}
          <div className="relative h-64 overflow-hidden rounded-2xl bg-brand-100">
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)",
                backgroundSize: "42px 42px",
              }}
            />
            <div className="absolute left-6 top-8 h-20 w-28 rounded-full bg-brand-300/30 blur-xl" />
            <div className="absolute bottom-10 right-4 h-16 w-16 rounded-full bg-sky-300/30 blur-xl" />

            {/* Route line */}
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 240 256" fill="none" preserveAspectRatio="none">
              <path d="M40 200 C 90 170, 70 90, 150 60 S 205 40, 205 36" stroke="#0d9668" strokeWidth="4" strokeDasharray="8 6" strokeLinecap="round" />
            </svg>

            {/* User beacon */}
            <div className="absolute left-8 bottom-20">
              <span className="absolute -inset-2 animate-pulse-ring rounded-full bg-red-400/40" />
              <span className="relative block h-4 w-4 rounded-full bg-red-500 ring-4 ring-red-200" />
            </div>

            {/* Collector */}
            <div className="absolute right-16 top-5 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 shadow">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
              </span>
              <span className="text-[10px] font-bold text-slate-700">{collectorLabel}</span>
            </div>

            {/* Pickup point */}
            <div className="absolute right-6 top-4 flex flex-col items-center">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 ring-4 ring-brand-100">
                <Trash2 className="h-3 w-3 text-white" />
              </span>
            </div>
          </div>

          {/* Pickup card */}
          <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">{t("hero.mockup.pickupRunning")}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{t("hero.mockup.pickupDetail")}</p>
              </div>
              <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[10px] font-bold text-brand-700">
                ETA 12 min
              </span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-2/3 rounded-full bg-brand-500 transition-all duration-700" />
            </div>
          </div>
        </div>
      </div>

      {/* Floating reward chip */}
      <div className="absolute -right-8 top-16 animate-float-slow rounded-2xl border border-brand-100 bg-white p-3 shadow-soft">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Recycle className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-800">{t("hero.mockup.points50")}</p>
            <p className="text-[11px] text-slate-500">{t("hero.mockup.pointsDone")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function WasteLogo() {
  return (
    <span className="flex items-center gap-1">
      <span className="flex h-4 w-4 items-center justify-center rounded-md bg-brand-600">
        <Trash2 className="h-2.5 w-2.5 text-white" />
      </span>
      <span className="text-xs font-extrabold tracking-tight text-slate-900">
        Waste<span className="text-brand-600">Track</span>
      </span>
    </span>
  );
}
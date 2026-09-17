import {
  Recycle,
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
import PhoneScreenshots from "./PhoneScreenshots";

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
            <PhoneScreenshots lang={lang} />
          </Reveal>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <Marquee items={marqueeItems} />
      </div>
    </section>
  );
}
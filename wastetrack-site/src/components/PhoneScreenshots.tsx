import { Recycle, Trash2 } from "lucide-react";
import { useLanguage } from "../lib/i18n";

interface PhoneScreenshotsProps {
  lang: "fr" | "en";
}

interface Screenshot {
  src: string;
  alt: string;
}

export default function PhoneScreenshots({ lang }: PhoneScreenshotsProps) {
  const { t } = useLanguage();

  const screenshots: Screenshot[] = [
    { src: "/screenshots/home.png", alt: t("download.screenshots.alt") + " - Accueil" },
    // { src: "/screenshots/map.png", alt: t("download.screenshots.alt") + " - Carte & suivi" },
    // { src: "/screenshots/pickup.png", alt: t("download.screenshots.alt") + " - Demande ramassage" },
    // { src: "/screenshots/profile.png", alt: t("download.screenshots.alt") + " - Profil & points" },
  ];

  const hasRealScreenshots = true; // Mettre à true quand les captures sont ajoutées dans /public/screenshots/

  if (hasRealScreenshots) {
    return (
      <div className="relative mx-auto hidden max-w-sm sm:block">
        <div className="pointer-events-none absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-white/20 to-transparent blur-2xl" />
        <div className="relative rounded-[2.6rem] border border-white/20 bg-slate-900 p-3 shadow-2xl">
          <div className="relative rounded-[2rem] bg-white overflow-hidden">
            <div className="relative aspect-[9/19.5] bg-slate-100">
              <img
                src={screenshots[0].src}
                alt={screenshots[0].alt}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </div>

        <div className="absolute -right-8 top-16 animate-float-slow rounded-2xl border border-brand-100 bg-white p-3 shadow-soft">
          <p className="text-sm font-bold text-slate-800">{t("hero.mockup.points50")}</p>
          <p className="text-[11px] text-slate-500">{t("hero.mockup.pointsDone")}</p>
        </div>

        {hasRealScreenshots && screenshots.length > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {screenshots.slice(1).map((shot, i) => (
            <button
              key={shot.src}
              className={`relative w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border-2 transition ${
                i === 0 ? "border-brand-500" : "border-slate-200 hover:border-brand-300"
              }`}
              aria-label={shot.alt}
            >
              <img src={shot.src} alt={shot.alt} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      </div>
    );
  }

  return <PhoneMockupFallback langLabel={lang === "fr" ? "FR" : "EN"} collectorLabel={t("hero.mockup.collector")} />;
}

function PhoneMockupFallback({ langLabel, collectorLabel }: { langLabel: string; collectorLabel: string }) {
  const { t } = useLanguage();
  return (
    <div className="relative mx-auto hidden max-w-sm sm:block">
      <div className="pointer-events-none absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-white/20 to-transparent blur-2xl" />
      <div className="relative rounded-[2.6rem] border border-white/20 bg-slate-900 p-3 shadow-2xl">
        <div className="relative rounded-[2rem] bg-white p-4">
          <div className="flex items-center justify-between px-1 pb-3">
            <span className="text-xs font-bold text-slate-800">9:41</span>
            <WasteLogo />
            <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">{langLabel}</span>
          </div>

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

            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 240 256" fill="none" preserveAspectRatio="none">
              <path d="M40 200 C 90 170, 70 90, 150 60 S 205 40, 205 36" stroke="#0d9668" strokeWidth="4" strokeDasharray="8 6" strokeLinecap="round" />
            </svg>

            <div className="absolute left-8 bottom-20">
              <span className="absolute -inset-2 animate-pulse-ring rounded-full bg-red-400/40" />
              <span className="relative block h-4 w-4 rounded-full bg-red-500 ring-4 ring-red-200" />
            </div>

            <div className="absolute right-16 top-5 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 shadow">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
              </span>
              <span className="text-[10px] font-bold text-slate-700">{collectorLabel}</span>
            </div>

            <div className="absolute right-6 top-4 flex flex-col items-center">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 ring-4 ring-brand-100">
                <Trash2 className="h-3 w-3 text-white" />
              </span>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">{t("hero.mockup.pickupRunning")}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{t("hero.mockup.pickupDetail")}</p>
              </div>
              <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[10px] font-bold text-brand-700">ETA 12 min</span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-2/3 rounded-full bg-brand-500 transition-all duration-700" />
            </div>
          </div>
        </div>
      </div>

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
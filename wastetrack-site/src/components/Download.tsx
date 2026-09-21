import { Smartphone, Download as DownloadIcon, Recycle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useLanguage } from "../lib/i18n";
import Reveal from "./Reveal";

const ANDROID_APK_URL = "https://expo.dev/artifacts/eas/N1jJ9yy13dZ1linkju02pun7QKqQBhEdSoMkmRHTt3I.apk";

export default function Download() {
  const { t } = useLanguage();

  return (
    <section id="telechargement" className="relative overflow-hidden bg-brand-950 py-20 sm:py-24">
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at 80% 20%, white 1.5px, transparent 1.5px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="pointer-events-none absolute -left-32 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full border-2 border-brand-400/20" />

      <div className="container-page relative">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-300 ring-1 ring-inset ring-brand-400/30">
              <Smartphone className="h-8 w-8" />
            </div>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">{t("dl.title")}</h2>
            <p className="mt-4 text-lg leading-relaxed text-white/75">{t("dl.subtitle")}</p>
          </Reveal>

<Reveal delay={120}>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <a
                  href="#"
                  onClick={(event) => event.preventDefault()}
                  className="inline-flex items-center gap-3 rounded-2xl bg-white px-6 py-3.5 text-slate-900 shadow-lg transition duration-300 hover:-translate-y-1 hover:bg-slate-100 hover:shadow-xl"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white">
                    <DownloadIcon className="h-5 w-5" />
                  </span>
                  <span className="text-left">
                    <span className="block text-[11px] font-medium text-slate-500">{t("dl.iosBadge")}</span>
                    <span className="block text-base font-bold">{t("dl.iosName")}</span>
                  </span>
                </a>
                <a
                  href={ANDROID_APK_URL}
                  className="inline-flex items-center gap-3 rounded-2xl bg-white px-6 py-3.5 text-slate-900 shadow-lg transition duration-300 hover:-translate-y-1 hover:bg-slate-100 hover:shadow-xl"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-white">
                    <DownloadIcon className="h-5 w-5" />
                  </span>
                  <span className="text-left">
                    <span className="block text-[11px] font-medium text-slate-500">{t("dl.iosBadge")}</span>
                    <span className="block text-base font-bold">{t("dl.androidName")}</span>
                  </span>
                </a>
              </div>
            </Reveal>

          <Reveal delay={220}>
            <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 transition duration-300 hover:bg-white/10 sm:flex-row">
              <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-white p-1.5 transition-transform duration-300 hover:scale-105">
                <QRCodeSVG value={ANDROID_APK_URL} size={84} level="M" />
              </div>
              <div className="text-center sm:text-left">
                <p className="flex items-center justify-center gap-2 text-sm font-bold text-white sm:justify-start">
                  <Recycle className="h-4 w-4 text-brand-300" />
                  {t("dl.scanTitle")}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-white/60">{t("dl.scanDesc")}</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <p className="mt-8 text-sm text-white/50">
              {t("dl.member")}{" "}
              <a
                href="#"
                onClick={(event) => event.preventDefault()}
                className="font-semibold text-brand-300 transition hover:text-brand-200"
              >
                {t("dl.login")}
              </a>
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
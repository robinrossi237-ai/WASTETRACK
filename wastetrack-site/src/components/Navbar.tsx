import { useEffect, useState } from "react";
import { Menu, X, Download, Send, Languages } from "lucide-react";
import { useLanguage } from "../lib/i18n";

const NAV_LINK_KEYS = [
  { href: "#comment-ca-marche", key: "nav.how" },
  { href: "#fonctionnalites", key: "nav.features" },
  { href: "#collecteurs", key: "nav.collectors" },
  { href: "#plans", key: "nav.plans" },
  { href: "#impact", key: "nav.impact" },
  { href: "#faq", key: "nav.faq" },
] as const;

const SECTION_IDS = ["accueil", "comment-ca-marche", "fonctionnalites", "collecteurs", "plans", "impact", "faq"];

export default function Navbar() {
  const { t, lang, setLang } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [whatsappHover, setWhatsappHover] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? (window.scrollY / max) * 100 : 0);
      setScrolled(window.scrollY > 12);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const elements = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => Boolean(el)
    );
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-35% 0px -60% 0px" }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open ]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/90 shadow-soft backdrop-blur" : "bg-transparent"
      }`}
    >
      <div
        className="absolute inset-x-0 top-0 h-0.5 origin-left bg-gradient-to-r from-brand-400 via-brand-600 to-emerald-300 transition-transform duration-150"
        style={{ transform: `scaleX(${progress / 100})` }}
      />

      <div className="container-page">
        <div className="flex h-16 items-center justify-between sm:h-18">
          <a href="#accueil" className="group flex items-center gap-2.5">
            <img
              src="/wastetrack-logo.png"
              alt="WasteTrack"
              className={`h-10 w-10 rounded-xl object-contain transition ${scrolled ? "" : "drop-shadow"}`}
            />
            <span
              className={`text-xl font-bold tracking-tight transition group-hover:opacity-80 ${
                scrolled ? "text-slate-900" : "text-white"
              }`}
            >
              Waste<span className="text-brand-500">Track</span>
            </span>
          </a>

          <nav className="hidden items-center gap-7 lg:flex">
            {NAV_LINK_KEYS.map((link) => {
              const isActive = active === link.href.slice(1);
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={`relative text-sm font-medium transition ${
                    scrolled ? "text-slate-600" : "text-white/85"
                  } hover:text-brand-500`}
                >
                  {t(link.key)}
                  <span
                    className={`absolute -bottom-2 left-0 h-0.5 rounded-full bg-brand-500 transition-all duration-300 ${
                      isActive ? "w-full opacity-100" : "w-0 opacity-0"
                    }`}
                  />
                </a>
              );
            })}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <button
              onClick={() => setLang(lang === "fr" ? "en" : "fr")}
              className={`flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold transition ${
                scrolled
                  ? "bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-600"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
              aria-label={lang === "fr" ? "Switch to English" : "Passer en français"}
            >
              <Languages className="h-4 w-4" />
              {lang === "fr" ? "EN" : "FR"}
            </button>
            <a
              href="#telechargement"
              className="btn-primary !py-2.5 transition-transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-600/30"
            >
              <Download className="h-4 w-4" />
              {t("nav.download")}
            </a>
            <a
              href="https://wa.me/237653468123"
              target="_blank"
              rel="noreferrer"
              onMouseEnter={() => setWhatsappHover(true)}
              onMouseLeave={() => setWhatsappHover(false)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                scrolled
                  ? "bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-600"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
              aria-label={t("nav.whatsapp")}
            >
              <Send
                className={`h-4.5 w-4.5 transition-transform duration-300 ${whatsappHover ? "scale-110" : ""}`}
              />
            </a>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={() => setLang(lang === "fr" ? "en" : "fr")}
              className={`rounded-lg px-2.5 py-2 text-sm font-bold transition ${
                scrolled ? "text-slate-800" : "text-white"
              }`}
              aria-label={lang === "fr" ? "Switch to English" : "Passer en français"}
            >
              {lang === "fr" ? "EN" : "FR"}
            </button>
            <button
              onClick={() => setOpen(!open)}
              className={`rounded-lg p-2 transition ${scrolled ? "text-slate-800" : "text-white"}`}
              aria-label={open ? t("nav.menu.close") : t("nav.menu.open")}
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

    </header>

    {/* Mobile drawer */}
    <div
      className={`fixed inset-0 z-[60] lg:hidden ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={() => setOpen(false)}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label={t("nav.menu.open")}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
          <span className="flex items-center gap-2">
            <img src="/wastetrack-logo.png" alt="WasteTrack" className="h-8 w-8 rounded-lg object-contain" />
            <span className="text-base font-bold tracking-tight text-slate-900">
              Waste<span className="text-brand-500">Track</span>
            </span>
          </span>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"
            aria-label={t("nav.menu.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {NAV_LINK_KEYS.map((link) => {
            const isActive = active === link.href.slice(1);
            return (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {t(link.key)}
                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-brand-500" : "bg-transparent"}`} />
              </a>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-slate-100 p-4">
          <a href="#telechargement" onClick={() => setOpen(false)} className="btn-primary w-full">
            <Download className="h-4 w-4" />
            {t("nav.download")}
          </a>
          <a
            href="https://wa.me/237653468123"
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
          >
            <Send className="h-4 w-4" />
            {t("nav.whatsapp")}
          </a>
        </div>
      </aside>
    </div>
    </>
  );
}
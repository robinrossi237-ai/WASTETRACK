import { Mail, MapPin, Send, Github, Linkedin, Phone } from "lucide-react";
import { useLanguage } from "../lib/i18n";

export default function Footer() {
  const { t } = useLanguage();

  const linkColumns = [
    {
      title: t("footer.product"),
      links: [
        { label: t("footer.f.how"), href: "#comment-ca-marche" },
        { label: t("footer.f.features"), href: "#fonctionnalites" },
        { label: t("footer.f.collectors"), href: "#collecteurs" },
        { label: t("footer.f.plans"), href: "#plans" },
      ],
    },
    {
      title: t("footer.resources"),
      links: [
        { label: t("footer.r.education"), href: "#education" },
        { label: t("footer.r.impact"), href: "#impact" },
        { label: t("footer.r.faq"), href: "#faq" },
        { label: t("footer.r.download"), href: "#telechargement" },
      ],
    },
    {
      title: t("footer.company"),
      links: [
        { label: t("footer.c.admin"), href: "#" },
        { label: t("footer.c.partner"), href: "#" },
      ],
    },
  ];

  const socials = [
    { name: "GitHub", href: "https://github.com/robinrossi237-ai/WASTETRACK/tree/main/wastetrack-site", icon: Github },
    { name: "LinkedIn", href: "https://www.linkedin.com/in/tambat-robin-rossi-de-kini-21080b425", icon: Linkedin },
  ];

  return (
    <footer className="border-t border-slate-100 bg-white">
      <div className="container-page py-14">
        <div className="grid gap-10 lg:grid-cols-4">
          <div>
            <a href="#accueil" className="flex items-center gap-2.5">
              <img src="/wastetrack-logo.png" alt="WasteTrack" className="h-10 w-10 rounded-xl object-contain" />
              <span className="text-xl font-bold tracking-tight text-slate-900">
                Waste<span className="text-brand-600">Track</span>
              </span>
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">{t("footer.tagline")}</p>
            <div className="mt-5 space-y-2">
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Mail className="h-4 w-4 text-brand-600" />
                robinrossi237@gmail.com
              </p>
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Phone className="h-4 w-4 text-brand-600" />
                +237 6 53 46 81 23
              </p>
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <MapPin className="h-4 w-4 text-brand-600" />
                Douala, Cameroun
              </p>
            </div>
          </div>

          {linkColumns.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">{column.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-slate-500 transition hover:text-brand-600">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">{t("footer.follow")}</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {socials.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition duration-300 hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700"
                >
                  <social.icon className="h-3.5 w-3.5" />
                  {social.name}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-6 sm:flex-row">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} WasteTrack. {t("footer.rights")}
          </p>
          <a
            href="https://wa.me/237653468123"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-brand-700"
          >
            <Send className="h-3.5 w-3.5" />
            {t("footer.whatsapp")}
          </a>
        </div>
      </div>
    </footer>
  );
}
import { X, FileText } from "lucide-react";
import { useLanguage } from "../lib/i18n";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "privacy" | "terms";
}

export default function LegalModal({ isOpen, onClose, type }: LegalModalProps) {
  const { t, lang } = useLanguage();
  const isPrivacy = type === "privacy";

  if (!isOpen) return null;

  const title = isPrivacy ? t("privacy.title") : t("terms.title");
  const lastUpdated = isPrivacy ? t("privacy.lastUpdated") : t("terms.lastUpdated");
  const sections = isPrivacy
    ? [
        { title: t("privacy.dataCollection.title"), content: t("privacy.dataCollection.content") },
        { title: t("privacy.usage.title"), content: t("privacy.usage.content") },
        { title: t("privacy.sharing.title"), content: t("privacy.sharing.content") },
        { title: t("privacy.rights.title"), content: t("privacy.rights.content") },
        { title: t("privacy.security.title"), content: t("privacy.security.content") },
        { title: t("privacy.retention.title"), content: t("privacy.retention.content") },
        { title: "", content: t("privacy.contact"), isContact: true },
      ]
    : [
        { title: t("terms.acceptance"), content: t("terms.acceptance") },
        { title: t("terms.service.title"), content: t("terms.service.content") },
        { title: t("terms.account.title"), content: t("terms.account.content") },
        { title: t("terms.collector.title"), content: t("terms.collector.content") },
        { title: t("terms.payment.title"), content: t("terms.payment.content") },
        { title: t("terms.liability.title"), content: t("terms.liability.content") },
        { title: t("terms.termination.title"), content: t("terms.termination.content") },
        { title: t("terms.changes.title"), content: t("terms.changes.content") },
        { title: t("terms.law.title"), content: t("terms.law.content") },
        { title: "", content: t("terms.contact"), isContact: true },
      ];

  const locale = lang === "fr" ? fr : enUS;
  const dateStr = format(new Date(), "PPPP", { locale });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white/95 backdrop-blur px-6 py-4">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-brand-600" />
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-slate-700 leading-relaxed">
          <p className="text-sm text-slate-500">{lastUpdated.replace("{date}", dateStr)}</p>

          {isPrivacy && <p className="text-base">{t("privacy.intro")}</p>}

          {sections.map((section, i) => (
            <div key={i} className={section.isContact ? "pt-4 border-t border-slate-100" : ""}>
              {section.title && (
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{section.title}</h3>
              )}
              <p className="text-slate-600 whitespace-pre-wrap">{section.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
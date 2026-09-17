import { BookOpen, Recycle, Trees, Info } from "lucide-react";
import { useLanguage } from "../lib/i18n";
import Reveal from "./Reveal";

export default function Education() {
  const { t } = useLanguage();

  const lessons = [
    {
      icon: Recycle,
      title: t("edu.l1.title"),
      description: t("edu.l1.desc"),
      color: "bg-brand-100 text-brand-700",
      tag: t("edu.l1.tag"),
    },
    {
      icon: Trees,
      title: t("edu.l2.title"),
      description: t("edu.l2.desc"),
      color: "bg-emerald-100 text-emerald-700",
      tag: t("edu.l2.tag"),
    },
    {
      icon: BookOpen,
      title: t("edu.l3.title"),
      description: t("edu.l3.desc"),
      color: "bg-sky-100 text-sky-700",
      tag: t("edu.l3.tag"),
    },
    {
      icon: Info,
      title: t("edu.l4.title"),
      description: t("edu.l4.desc"),
      color: "bg-amber-100 text-amber-700",
      tag: t("edu.l4.tag"),
    },
  ];

  const bullets = [t("edu.b1"), t("edu.b2"), t("edu.b3")];

  return (
    <section id="education" className="bg-slate-50 py-20 sm:py-24">
      <div className="container-page">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Reveal>
              <span className="chip">{t("edu.chip")}</span>
              <h2 className="section-title mt-4">{t("edu.title")}</h2>
              <p className="section-subtitle">{t("edu.subtitle")}</p>
            </Reveal>
            <Reveal delay={120}>
              <ul className="mt-8 space-y-4">
                {bullets.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-slate-700">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white">
                      <Recycle className="h-3.5 w-3.5" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {lessons.map((lesson, index) => (
              <Reveal key={lesson.title} delay={index * 100}>
                <div className="group rounded-2xl border border-slate-100 bg-white p-5 shadow-soft transition duration-300 hover:-translate-y-1.5 hover:border-brand-200 hover:shadow-lg">
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${lesson.color}`}
                    >
                      <lesson.icon className="h-5 w-5" />
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {lesson.tag}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-bold text-slate-900">{lesson.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{lesson.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
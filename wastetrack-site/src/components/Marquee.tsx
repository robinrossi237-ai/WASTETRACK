import type { LucideIcon } from "lucide-react";

type MarqueeItem = {
  icon: LucideIcon;
  label: string;
};

type MarqueeProps = {
  items: MarqueeItem[];
};

export default function Marquee({ items }: MarqueeProps) {
  const doubled = [...items, ...items];
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-brand-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-brand-950 to-transparent" />
      <div className="marquee-paused flex w-max animate-marquee items-center gap-10 py-5 pr-10">
        {doubled.map((item, index) => (
          <span
            key={`${item.label}-${index}`}
            className="flex shrink-0 items-center gap-2.5 text-sm font-semibold text-white/70"
          >
            <item.icon className="h-4 w-4 text-brand-300" />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
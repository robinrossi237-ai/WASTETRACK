import type { ReactNode } from "react";
import { useInView } from "../lib/useInView";

type RevealProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
  direction?: "up" | "left" | "right" | "none";
};

const HIDDEN: Record<NonNullable<RevealProps["direction"]>, string> = {
  up: "translate-y-8",
  left: "-translate-x-8",
  right: "translate-x-8",
  none: "",
};

export default function Reveal({
  children,
  delay = 0,
  className = "",
  direction = "up",
}: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      style={{ transitionDelay: delay ? `${delay}ms` : undefined }}
      className={`transition-all duration-700 ease-out will-change-transform ${
        inView ? "translate-x-0 translate-y-0 opacity-100" : `opacity-0 ${HIDDEN[direction]}`
      } ${className}`}
    >
      {children}
    </div>
  );
}
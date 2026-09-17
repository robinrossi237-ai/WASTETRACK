import type { SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

const baseIconProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
};

const Title = ({ title }: { title?: string }) => (title ? <title>{title}</title> : null);

export const LeafIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="M11 21c-4.5 0-8-3.5-8-8C3 7 7 3 13 3c5 0 8 3 8 8 0 6-4 10-10 10Z" />
    <path d="M7 14c1.5-1 4.5-2 9-2" />
    <path d="M8 17c2-3 5-6 10-10" />
  </svg>
);

export const DashboardIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <rect x="3" y="3" width="8" height="8" rx="2" />
    <rect x="13" y="3" width="8" height="5" rx="2" />
    <rect x="13" y="10" width="8" height="11" rx="2" />
    <rect x="3" y="13" width="8" height="8" rx="2" />
  </svg>
);

export const UsersIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="M17 21v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" />
    <circle cx="9.5" cy="8" r="3.5" />
    <path d="M22 21v-1a4 4 0 0 0-3-3.87" />
    <path d="M16 4.13a3.5 3.5 0 0 1 0 6.74" />
  </svg>
);

export const ReportIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="M14 2H6a2 2 0 0 0-2 2v16l4-3h8a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
    <path d="M8 11h6" />
    <path d="M8 14h4" />
  </svg>
);

export const MessageIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    <path d="M8 9h8" />
    <path d="M8 13h6" />
  </svg>
);

export const TruckIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="M10 17h4V5H2v12h2" />
    <path d="M14 8h4l4 4v5h-2" />
    <circle cx="7" cy="17" r="2" />
    <circle cx="17" cy="17" r="2" />
  </svg>
);

export const ClipboardIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <rect x="9" y="2" width="6" height="4" rx="1" />
    <path d="M9 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
    <path d="M8 11h8" />
    <path d="M8 15h6" />
  </svg>
);

export const BookIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="M4 19a2 2 0 0 0 2 2h14" />
    <path d="M4 5a2 2 0 0 1 2-2h14v18H6a2 2 0 0 1-2-2Z" />
    <path d="M8 7h8" />
    <path d="M8 11h8" />
  </svg>
);

export const GiftIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" />
    <path d="M2 7h20v5H2z" />
    <path d="M12 22V7" />
    <path d="M12 7c-1.5 0-3-1-3-2.5S10.5 2 12 2c.9 0 1.7.4 2.2 1.1" />
    <path d="M12 7c1.5 0 3-1 3-2.5S13.5 2 12 2c-.9 0-1.7.4-2.2 1.1" />
  </svg>
);

export const LogoutIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="M10 17l5-5-5-5" />
    <path d="M15 12H3" />
    <path d="M21 21V3" />
  </svg>
);

export const SearchIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.2-3.2" />
  </svg>
);

export const RefreshIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </svg>
);

export const PlusIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

export const PencilIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
  </svg>
);

export const TrashIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
);

export const CheckIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const XIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="M18 6 6 18" />
    <path d="M6 6l12 12" />
  </svg>
);

export const UserPlusIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="M15 21v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" />
    <circle cx="8.5" cy="8" r="3.5" />
    <path d="M20 8v6" />
    <path d="M17 11h6" />
  </svg>
);

export const PowerIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="M12 2v10" />
    <path d="M6.38 6.38a8 8 0 1 0 11.24 0" />
  </svg>
);

export const MapIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="m9 3-6 2v15l6-2 6 2 6-2V3l-6 2Z" />
    <path d="M9 3v15" />
    <path d="M15 5v15" />
  </svg>
);

export const DownloadIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5" />
    <path d="M12 15V3" />
  </svg>
);

export const MegaphoneIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="M3 11v8a1 1 0 0 0 1 1h2.83a2 2 0 0 0 1.42-.59l1.76-1.76" />
    <path d="M12 19V5" />
    <path d="M15 8.5c1.14.76 2.5 1.14 4 1.14V5.36c-1.5 0-2.86-.38-4-1.14" />
    <path d="M12 5 5 7" />
  </svg>
);

export const ShieldIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
  </svg>
);

export const TrophyIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="M8 21h8" />
    <path d="M12 17v4" />
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <path d="M17 6h2a2 2 0 0 1 0 4h-2" />
    <path d="M7 6H5a2 2 0 0 0 0 4h2" />
  </svg>
);

export const TagIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="M20.59 13.41 12 4.83V3H5v7h1.83l8.59 8.59a2 2 0 0 0 2.83 0l2.34-2.34a2 2 0 0 0 0-2.83Z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
  </svg>
);

export const ClockIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const PhoneIcon = ({ title, className, ...props }: IconProps) => (
  <svg {...baseIconProps} className={className ?? 'h-5 w-5'} {...props}>
    <Title title={title} />
    <path d="m22 16.92-3.2-.37a2 2 0 0 0-1.9.58l-2.3 2.3a16 16 0 0 1-7.2-7.2l2.3-2.3a2 2 0 0 0 .58-1.9L7.08 2A2 2 0 0 0 5.1.35H2.5A2.5 2.5 0 0 0 0 2.85 21 21 0 0 0 21.15 24a2.5 2.5 0 0 0 2.5-2.5v-2.58a2 2 0 0 0-1.65-2Z" />
  </svg>
);

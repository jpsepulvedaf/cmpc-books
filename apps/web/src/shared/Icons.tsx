// Accessible inline SVG icons (aria-hidden; label them via the parent control).

interface IconProps {
  size?: number;
}

function icon(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  } as const;
}

export function IconSearch({ size = 18 }: IconProps) {
  return (
    <svg {...icon(size)}>
      <circle cx="11" cy="12" r="7" />
      <path d="M8 9 L14 9 L14 17 L8 17 M10 19 L14 19" />
    </svg>
  );
}

export function IconPlus({ size = 18 }: IconProps) {
  return (
    <svg {...icon(size)}>
      <path d="M12 4 L12 20 M6 12 L18 12" />
    </svg>
  );
}

export function IconDownload({ size = 18 }: IconProps) {
  return (
    <svg {...icon(size)}>
      <path d="M12 4 L12 9 M12 9 L4 14 L20 14 M4 14 L4 20 L20 20 M4 18 L20 18" />
    </svg>
  );
}

export function IconClose({ size = 18 }: IconProps) {
  return (
    <svg {...icon(size)}>
      <path d="M6 6 L18 18 M18 6 L6 18" />
    </svg>
  );
}

export function IconTrash({ size = 18 }: IconProps) {
  return (
    <svg {...icon(size)}>
      <path d="M4 4 L20 4 L20 8 L4 8 M7 9 L17 9 L17 16 L7 16 M9 13 L15 13" />
    </svg>
  );
}

export function IconEdit({ size = 18 }: IconProps) {
  return (
    <svg {...icon(size)}>
      <path d="M5 5 L19 5 L19 10 L5 10 L5 19 L19 19 M19 10 L19 19" />
      <path d="M6 13 L18 13" />
    </svg>
  );
}

export function IconEye({ size = 18 }: IconProps) {
  return (
    <svg {...icon(size)}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

export function IconMenu({ size = 18 }: IconProps) {
  return (
    <svg {...icon(size)}>
      <path d="M4 5 L20 5 M4 12 L20 12 M4 19 L20 19" />
    </svg>
  );
}

export function IconChevronDown({ size = 16 }: IconProps) {
  return (
    <svg {...icon(size)}>
      <path d="M6 8 L18 8 L12 16 Z" />
    </svg>
  );
}

export function IconBooks({ size = 22 }: IconProps) {
  return (
    <svg {...icon(size)}>
      <rect x="4" y="5" width="7" height="15" rx="2" />
      <rect x="13" y="3" width="7" height="17" rx="2" />
      <path d="M13 20 L19 20 M6 6 L10 6" />
    </svg>
  );
}
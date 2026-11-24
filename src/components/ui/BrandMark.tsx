import type { CSSProperties } from 'react';

interface BrandMarkProps {
  className?: string;
  accent?: string;
  style?: CSSProperties;
}

export function BrandMark({ className, accent = 'var(--accent)', style }: BrandMarkProps): JSX.Element {
  return (
    <svg className={className} style={style} viewBox="0 0 64 64" fill="none" aria-label="TOKI">
      <rect x="2" y="2" width="60" height="60" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 20h42M32 20v34" stroke="currentColor" strokeWidth="3" />
      <path d="M11 46h13M40 46h13" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 11h9M44 11h9" stroke={accent} strokeWidth="2" />
      <path d="M11 53h9M44 53h9" stroke={accent} strokeWidth="2" />
      <circle cx="32" cy="20" r="3.5" fill={accent} />
    </svg>
  );
}

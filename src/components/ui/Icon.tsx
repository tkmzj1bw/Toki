import type { SVGProps } from 'react';

export type IconName =
  | 'overview'
  | 'studio'
  | 'machine'
  | 'monitor'
  | 'projects'
  | 'system'
  | 'chevron'
  | 'plug'
  | 'bell'
  | 'home'
  | 'play'
  | 'pause'
  | 'stop'
  | 'plus'
  | 'trash'
  | 'undo'
  | 'redo'
  | 'eye'
  | 'eyeOff'
  | 'lock'
  | 'unlock'
  | 'download'
  | 'upload'
  | 'save'
  | 'x'
  | 'maximize'
  | 'minimize'
  | 'filter'
  | 'check'
  | 'alert'
  | 'refresh'
  | 'cursor'
  | 'line'
  | 'rect'
  | 'circle'
  | 'polyline'
  | 'hand'
  | 'pen'
  | 'thermal'
  | 'power'
  | 'query'
  | 'folder'
  | 'clock'
  | 'layers'
  | 'command';

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

const paths: Record<IconName, JSX.Element> = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  studio: (
    <>
      <path d="M3 20l4-1 11-11-3-3L4 16z" />
      <path d="M14 6l3 3" />
      <path d="M17 3l4 4-3 3-4-4z" />
    </>
  ),
  machine: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="7" cy="17" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  monitor: (
    <>
      <path d="M3 17l4-6 4 3 4-8 6 5" />
      <path d="M3 21h18" />
    </>
  ),
  projects: (
    <>
      <path d="M3 7h7l2 2h9v10H3z" />
      <path d="M3 7V5h6l2 2" />
    </>
  ),
  system: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
  chevron: <path d="M9 6l6 6-6 6" />,
  plug: (
    <>
      <path d="M9 3v5M15 3v5" />
      <path d="M6 8h12v3a6 6 0 0 1-12 0z" />
      <path d="M12 17v4" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V10a6 6 0 0 1 12 0v6l2 2H4z" />
      <path d="M10 20h4" />
    </>
  ),
  home: (
    <>
      <path d="M4 11l8-7 8 7" />
      <path d="M6 10v10h12V10" />
    </>
  ),
  play: <path d="M8 5l11 7-11 7z" />,
  pause: (
    <>
      <path d="M8 5v14M16 5v14" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="1" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" />
    </>
  ),
  undo: <path d="M9 7H4V2M4 7a9 9 0 1 1 0 10" />,
  redo: <path d="M15 7h5V2M20 7a9 9 0 1 0 0 10" />,
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="1" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="1" />
      <path d="M8 10V7a4 4 0 0 1 7-2.6" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 20h16" />
    </>
  ),
  save: (
    <>
      <path d="M4 4h13l3 3v13H4z" />
      <path d="M8 4v6h8V4M8 20v-6h8v6" />
    </>
  ),
  x: <path d="M5 5l14 14M19 5L5 19" />,
  maximize: <path d="M4 9V4h5M20 15v5h-5M4 15v5h5M20 9V4h-5" />,
  minimize: <path d="M9 4v5H4M15 20v-5h5M9 20v-5H4M15 4v5h5" />,
  filter: <path d="M3 5h18l-7 8v6l-4-2v-4z" />,
  check: <path d="M4 12l5 5L20 6" />,
  alert: (
    <>
      <path d="M12 3L2 21h20z" />
      <path d="M12 9v5M12 17h.01" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7a9 9 0 0 0-15-2L3 7" />
      <path d="M3 3v4h4" />
      <path d="M4 17a9 9 0 0 0 15 2l2-2" />
      <path d="M21 21v-4h-4" />
    </>
  ),
  cursor: <path d="M5 3l14 9-6 1-3 6z" />,
  line: <path d="M4 19L20 5" />,
  rect: <rect x="4" y="5" width="16" height="14" rx="1" />,
  circle: <circle cx="12" cy="12" r="8" />,
  polyline: <path d="M3 18l6-9 5 5 7-11" />,
  hand: <path d="M8 13V6a1.5 1.5 0 0 1 3 0v5V4a1.5 1.5 0 0 1 3 0v7V6a1.5 1.5 0 0 1 3 0v8a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5v-3a1.5 1.5 0 0 1 3 0" />,
  pen: <path d="M4 20l5-1L20 8l-4-4L5 15z" />,
  thermal: (
    <>
      <path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z" />
      <path d="M12 10v7" />
    </>
  ),
  power: (
    <>
      <path d="M12 3v9" />
      <path d="M7 6a8 8 0 1 0 10 0" />
    </>
  ),
  query: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M16 16l5 5" />
    </>
  ),
  folder: <path d="M3 7h7l2 2h9v10H3z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l4 2" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  command: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
};

export function Icon({ name, size = 18, ...rest }: IconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}

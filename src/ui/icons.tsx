import type { ReactNode, SVGProps } from 'react';

const Icon = ({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {children}
  </svg>
);

export const UndoIcon = () => (
  <Icon>
    <path d="M4.5 9.5h9a5 5 0 0 1 0 10h-6" />
    <path d="M8 5 4.5 9.5 8 14" />
  </Icon>
);

export const RedoIcon = () => (
  <Icon>
    <path d="M19.5 9.5h-9a5 5 0 0 0 0 10h6" />
    <path d="M16 5l3.5 4.5L16 14" />
  </Icon>
);

export const EraseIcon = () => (
  <Icon>
    <path d="m13.6 4.4 6 6a1.5 1.5 0 0 1 0 2.1l-6.4 6.4a2 2 0 0 1-1.4.6H8.2a2 2 0 0 1-1.4-.6l-2.7-2.7a1.5 1.5 0 0 1 0-2.1l9.4-9.7a1.5 1.5 0 0 1 2.1 0Z" />
    <path d="m8.5 9.5 6 6" />
  </Icon>
);

export const PencilIcon = () => (
  <Icon>
    <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17l-1 4Z" />
    <path d="m14.5 7.5 3 3" />
  </Icon>
);

export const HintIcon = () => (
  <Icon>
    <path d="M9.5 18h5" />
    <path d="M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.9.7 1.5 1.3 1.5 2.1h4c0-.8.6-1.4 1.5-2.1A6 6 0 0 0 12 3Z" />
  </Icon>
);

export const NotesIcon = () => (
  <Icon>
    <path d="M5 4v5M2.5 6.5h5" />
    <path d="M18 4.5 20 6l-6.5 8H11v-2.5L18 4.5Z" />
    <path d="M4 15v5h16" />
  </Icon>
);

export const PauseIcon = () => (
  <Icon>
    <path d="M9 5.5v13M15 5.5v13" />
  </Icon>
);

export const PlayIcon = () => (
  <Icon>
    <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" stroke="none" />
  </Icon>
);

export const MoreIcon = () => (
  <Icon>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </Icon>
);

export const CloseIcon = () => (
  <Icon>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
);

export const CheckIcon = () => (
  <Icon>
    <path d="m4.5 12.5 5 5L19.5 7" />
  </Icon>
);

export const GearIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1" />
  </Icon>
);

export const StatsIcon = () => (
  <Icon>
    <path d="M4 20V10M10 20V4M16 20v-8M21 20H4" />
  </Icon>
);

export const DownloadIcon = () => (
  <Icon>
    <path d="M12 4v10M8 10.5l4 4 4-4" />
    <path d="M5 19h14" />
  </Icon>
);

export const RestartIcon = () => (
  <Icon>
    <path d="M19 12a7 7 0 1 1-2.05-4.95" />
    <path d="M17 3v4.5h-4.5" />
  </Icon>
);

export const SparkleIcon = () => (
  <Icon>
    <path d="M12 4.5 13.8 10 19 12l-5.2 2-1.8 5.5L10.2 14 5 12l5.2-2L12 4.5Z" />
  </Icon>
);

export const BroomIcon = () => (
  <Icon>
    <path d="m14 4 6 6" />
    <path d="M17 7 9.5 14.5" />
    <path d="M4 20c2.5 0 6.5-.5 8.5-2.5L10 15c-2 2-4.5 2.5-6 5Z" />
  </Icon>
);

export const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

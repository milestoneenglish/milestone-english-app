import type { IconName } from "@/lib/roles";

type IconProps = { className?: string };

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

// Ikon yang sama dengan desain lama (lpIcon) ditambah ikon menu portal.
const PATHS: Record<string, string> = {
  target: "M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z",
  users: "M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m8-4.13a4 4 0 11-8 0 4 4 0 018 0z",
  chart: "M4 19V5m0 14h16M8 15v-4m4 4V8m4 7v-6",
  book: "M12 6.5A6.5 6.5 0 005.5 4H4v15h1.5A6.5 6.5 0 0112 21m0-14.5A6.5 6.5 0 0118.5 4H20v15h-1.5A6.5 6.5 0 0012 21m0-14.5V21",
  mic: "M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3zm7-3a7 7 0 01-14 0m7 7v3m-4 0h8",
  check: "M5 13l4 4L19 7",
  arrow: "M5 12h14m-6-6l6 6-6 6",
  home: "M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z",
  test: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  calendar: "M8 3v4m8-4v4M4 9h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z",
  task: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  report: "M9 17v-2m3 2v-4m3 4v-6M6 3h9l5 5v12a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z",
  wallet: "M3 7a2 2 0 012-2h13v4M3 7v10a2 2 0 002 2h15V9H5a2 2 0 01-2-2zm14 7h.01",
  help: "M8.2 9a4 4 0 017.6 1.5c0 2.5-3.8 3-3.8 5M12 19h.01M22 12a10 10 0 11-20 0 10 10 0 0120 0z",
  layers: "M12 3l9 5-9 5-9-5 9-5zm-9 9l9 5 9-5M3 16l9 5 9-5",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7.3 7.3 0 00-2-1.2L14.5 3h-5l-.4 2.6a7.3 7.3 0 00-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 000 2.4l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 002 1.2l.4 2.6h5l.4-2.6a7.3 7.3 0 002-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z",
  edit: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.6a2 2 0 112.8 2.8L11.8 15H9v-2.8l8.6-8.6z",
  logout: "M15 16l4-4-4-4m4 4H9m4 8H6a2 2 0 01-2-2V6a2 2 0 012-2h7",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  mail: "M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1zm0 1l8 6 8-6",
  chevron: "M6 9l6 6 6-6",
  bell: "M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  key: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.7 5.7L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.6a1 1 0 01.3-.7l6-6A6 6 0 1121 9z",
};

export function Icon({ name, className = "w-6 h-6" }: { name: IconName | keyof typeof PATHS } & IconProps) {
  if (name === "star") {
    return (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2z" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
      <path d={PATHS[name] ?? PATHS.check} />
    </svg>
  );
}

export function WhatsappIcon({ className = "w-7 h-7" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 2.2C6.6 2.2 2.2 6.5 2.2 11.8c0 1.7.5 3.4 1.3 4.8L2.2 21.8l5.4-1.4c1.4.8 2.9 1.1 4.4 1.1 5.4 0 9.8-4.3 9.8-9.6S17.4 2.2 12 2.2zm0 17.6c-1.4 0-2.7-.4-3.9-1l-.3-.2-3.2.8.8-3.1-.2-.3a7.8 7.8 0 01-1.2-4.2c0-4.4 3.6-7.9 8-7.9s8 3.5 8 7.9-3.6 8-8 8zm4.4-5.9c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.5 6.5 0 01-3.2-2.8c-.2-.4.2-.4.7-1.2.1-.1 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.1 1.6 2.5 3.9 3.5 1.5.6 2 .7 2.8.6.4-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1l-.4-.2z" />
    </svg>
  );
}

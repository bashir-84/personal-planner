import type {CSSProperties} from "react";
const paths = {
  plus: "M12 5v14M5 12h14",
  plan: "M8 3v4M16 3v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1M8 15l3 3 5-5",
  calendar: "M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z",
  list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  edit: "m15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z",
  refresh: "M20 11a8.1 8.1 0 0 0-14.9-4M4 4v4h4M4 13a8.1 8.1 0 0 0 14.9 4M20 20v-4h-4",
  grip: "M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01",
  clock: "M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  deadline: "M5 3h14M5 21h14M7 3v4l10 10v4M17 3v4L7 17v4",
  chevron: "m8 10 4 4 4-4",
  next: "m9 6 6 6-6 6",
  previous: "m15 6-6 6 6 6",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6",
  project: "M12 3 3 8l9 5 9-5-9-5ZM3 12l9 5 9-5M3 16l9 5 9-5",
  note: "M5 3h14v18H5zM8 8h8M8 12h8M8 16h5",
  warning: "M12 9v4M12 17h.01M10.3 3.9 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
} as const;
export function Icon({name, style}: {name: keyof typeof paths; style?: CSSProperties}) {
  return <svg className="icon" style={style} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}

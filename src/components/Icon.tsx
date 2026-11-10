import type {CSSProperties} from "react";
const paths = {
  plus: "M12 5v14M5 12h14",
  plan: "M8 3v4M16 3v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1M8 15l3 3 5-5",
  edit: "m15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z",
  clock: "M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  deadline: "M5 3h14M5 21h14M7 3v4l10 10v4M17 3v4L7 17v4",
  chevron: "m8 10 4 4 4-4",
  next: "m9 6 6 6-6 6",
  previous: "m15 6-6 6 6 6",
  close: "m6 6 12 12M6 18 18 6",
} as const;
export function Icon({name, style}: {name: keyof typeof paths; style?: CSSProperties}) {
  return <svg className="icon" style={style} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}

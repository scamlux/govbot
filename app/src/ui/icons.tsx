import Svg, { Circle, Path, Rect } from "react-native-svg";

/** Stroke icons ported 1:1 from the design mockups (24x24 viewBox). */
type Shape =
  | { t: "path"; d: string }
  | { t: "rect"; x: number; y: number; w: number; h: number; r: number }
  | { t: "circle"; cx: number; cy: number; r: number };

const p = (d: string): Shape => ({ t: "path", d });
const rect = (x: number, y: number, w: number, h: number, r: number): Shape => ({ t: "rect", x, y, w, h, r });
const circle = (cx: number, cy: number, r: number): Shape => ({ t: "circle", cx, cy, r });

export const ICONS = {
  home: [p("M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z")],
  chat: [p("M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z")],
  grid: [rect(3, 3, 7, 7, 2), rect(14, 3, 7, 7, 2), rect(3, 14, 7, 7, 2), rect(14, 14, 7, 7, 2)],
  cases: [p("M9 11l3 3 8-8"), p("M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9")],
  user: [circle(12, 8, 4), p("M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6")],
  docs: [rect(4, 3, 16, 18, 3), circle(12, 10, 3), p("M8 17h8")],
  chart: [p("M4 20V10M10 20V4M16 20v-8M22 20H2")],
  briefcase: [rect(3, 7, 18, 13, 2), p("M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2")],
  heart: [p("M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z")],
  plane: [p("M2 16l20-8-6 12-3-5-5 3z")],
  building: [p("M3 21h18M5 21V8l7-5 7 5v13")],
  car: [p("M5 17h14M6 17l1.5-6h9L18 17M7 17v2M17 17v2"), circle(8.5, 14.5, 0.6)],
  mic: [rect(9, 2, 6, 12, 3), p("M5 11a7 7 0 0 0 14 0M12 18v4")],
  arrowUp: [p("M12 19V5M5 12l7-7 7 7")],
  arrowRight: [p("M5 12h14M13 6l6 6-6 6")],
  chevronLeft: [p("M15 5l-7 7 7 7")],
  chevronRight: [p("M9 5l7 7-7 7")],
  chevronDown: [p("M6 9l6 6 6-6")],
  plus: [p("M12 5v14M5 12h14")],
  close: [p("M6 6l12 12M18 6L6 18")],
  search: [circle(11, 11, 7), p("M20 20l-3.5-3.5")],
  trash: [p("M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3")],
  edit: [p("M12 20h9"), p("M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z")],
  speaker: [p("M11 5L6 9H2v6h4l5 4z"), p("M15.5 8.5a5 5 0 0 1 0 7")],
  simple: [p("M4 6h16M4 12h10M4 18h7")],
  copy: [rect(9, 9, 11, 11, 2), p("M5 15V6a2 2 0 0 1 2-2h9")],
  share: [p("M12 3v12M7 8l5-5 5 5"), p("M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6")],
  thumbUp: [p("M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h6a2 2 0 0 1 2 2l-1 6a2 2 0 0 1-2 2H7")],
  thumbDown: [p("M7 13V4H4v9zM7 13l4 8a2 2 0 0 0 2-2v-4h6a2 2 0 0 0 2-2l-1-6a2 2 0 0 0-2-2H7")],
  bell: [p("M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0")],
  calendar: [rect(3, 5, 18, 16, 3), p("M3 10h18M8 3v4M16 3v4")],
  check: [p("M5 12.5l4.5 4.5L19 7.5")],
  eye: [p("M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"), circle(12, 12, 3)],
  eyeOff: [p("M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.7A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4.2-1")],
  link: [p("M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1")],
  phone: [p("M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z")],
  shield: [p("M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"), p("M9 12l2 2 4-4")],
  wifiOff: [p("M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5-2.7M19 12.9a10 10 0 0 0-2.3-1.7M2 8.8a15 15 0 0 1 4.2-2.7M22 8.8A15 15 0 0 0 10 5.1"), circle(12, 20, 0.5)],
  alert: [p("M12 9v4M12 17h.01"), p("M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z")],
  globe: [circle(12, 12, 9), p("M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18")],
  type: [p("M4 7V5h16v2M9 19h6M12 5v14")],
  contrast: [circle(12, 12, 9), p("M12 3v18"), p("M12 3a9 9 0 0 1 0 18z")],
  vibrate: [rect(8, 3, 8, 18, 2), p("M4 8v8M20 8v8")],
  info: [circle(12, 12, 9), p("M12 11v5M12 8h.01")],
  logout: [p("M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9")],
  download: [p("M12 3v12M7 10l5 5 5-5M5 21h14")],
  card: [rect(2, 5, 20, 14, 3), p("M2 10h20")],
  sparkle: [p("M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.7 1.8L21.5 19.5l-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z")],
  pause: [p("M9 5v14M15 5v14")],
  bookmark: [p("M6 3h12v18l-6-4-6 4z")],
  clock: [circle(12, 12, 9), p("M12 7v5l3 2")],
} as const satisfies Record<string, readonly Shape[]>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, color = "#1D1D1F", strokeWidth = 2 }: IconProps) {
  const shapes: readonly Shape[] = ICONS[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {shapes.map((s, i) => {
        const common = { stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;
        if (s.t === "path") return <Path key={i} d={s.d} {...common} />;
        if (s.t === "rect") return <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} {...common} />;
        return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} {...common} />;
      })}
    </Svg>
  );
}

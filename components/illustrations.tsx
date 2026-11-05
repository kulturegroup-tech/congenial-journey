// Small drawn illustrations for the moments on Today (see lib/moments.ts). 96×96, ink outlines, flat fills.
// Classes starting with m- animate once when the moment plays (app/globals.css); without them they sit still.
import type { CSSProperties, ReactNode } from "react";
import type { MomentKind } from "@/lib/moments";

const INK = "#1d2a24";
const C = {
  amber: "#f4a93b",
  flame: "#fde7a6",
  gold: "#f6c945",
  clay: "#c8693c",
  clayDark: "#a5522c",
  saffron: "#ee8a3c",
  green: "#3f8a4d",
  leaf: "#5b8c4a",
  navy: "#2b3a67",
  pink: "#e46b8f",
  sky: "#6fa6dc",
  cream: "#f7efe0",
  forest: "#24453a",
  sage: "#c9d6a0",
  white: "#ffffff",
  red: "#e0584f",
  bamboo: "#c99a5b",
  grey: "#9aa39d",
};

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

function Svg({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 96 96" width="96" height="96" role="img" aria-label={label} stroke={INK} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none">
      {children}
    </svg>
  );
}

const Diya = () => (
  <>
    <circle className="m-glow" cx="66" cy="32" r="20" fill={C.gold} stroke="none" opacity="0.3" />
    <g className="m-flame">
      <path d="M66 14c6 8 9 13 9 19a9 9 0 0 1-18 0c0-6 3-11 9-19z" fill={C.amber} />
      <path d="M66 26c3 4 4 6 4 8.5a4 4 0 0 1-8 0c0-2.5 1-4.5 4-8.5z" fill={C.flame} stroke="none" />
    </g>
    <path d="M66 42v5" />
    <g className="m-pop">
      <path d="M12 50c14 3 40 3 54-1l14-5c-2 6-6 9-11 11-4 14-15 22-30 22-15 0-25-10-27-27z" fill={C.clay} />
      <path d="M12 50c14 3 40 3 54-1" />
      <path d="M26 62c4 2 9 3 14 3s10-1 14-3" stroke={C.gold} strokeWidth={2.6} />
      <circle cx="33" cy="70" r="1.6" fill={C.gold} stroke="none" />
      <circle cx="40" cy="72" r="1.6" fill={C.gold} stroke="none" />
      <circle cx="47" cy="70" r="1.6" fill={C.gold} stroke="none" />
      <path d="M30 77h20l-2 6H32z" fill={C.clayDark} />
    </g>
  </>
);

const Star = () => (
  <>
    <path d="M48 4v14" />
    <g className="m-swing" style={{ transformOrigin: "50% 0%" }}>
      <path d="M48 18l7.6 15.4 17 2.5-12.3 12 2.9 16.9L48 56.8l-15.2 8 2.9-16.9-12.3-12 17-2.5z" fill={C.red} />
      <path d="M48 31l3.4 6.9 7.6 1.1-5.5 5.4 1.3 7.6L48 48.4l-6.8 3.6 1.3-7.6-5.5-5.4 7.6-1.1z" fill={C.gold} />
      <path d="M38 63l-4 18M44 60l-1 22M52 60l1 22M58 63l4 18" stroke={C.gold} strokeWidth={2} />
    </g>
    <path className="m-twinkle" style={d(400)} d="M16 22v8M12 26h8" stroke={C.amber} />
    <path className="m-twinkle" style={d(550)} d="M80 50v6M77 53h6" stroke={C.amber} />
  </>
);

const Sparkler = () => (
  <>
    <path d="M18 86l34-38" stroke={C.grey} strokeWidth={3} />
    <path d="M18 86l8-9" strokeWidth={4.5} />
    <g className="m-burst">
      {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((a, i) => {
        const r = (a * Math.PI) / 180;
        const [x1, y1, x2, y2] = [56 + Math.cos(r) * 8, 42 + Math.sin(r) * 8, 56 + Math.cos(r) * (i % 2 ? 20 : 26), 42 + Math.sin(r) * (i % 2 ? 20 : 26)];
        return <path key={a} className="m-draw" pathLength={1} style={d(i * 40)} d={`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`} stroke={i % 3 ? C.amber : C.gold} strokeWidth={2.4} />;
      })}
      <circle cx="56" cy="42" r="4" fill={C.flame} stroke={C.amber} />
    </g>
    {[
      [80, 22, 300],
      [30, 30, 420],
      [84, 58, 520],
      [70, 74, 360],
    ].map(([x, y, t]) => (
      <circle key={`${x}${y}`} className="m-twinkle" style={d(t)} cx={x} cy={y} r="2" fill={C.gold} stroke="none" />
    ))}
  </>
);

const Kite = () => (
  <>
    <path className="m-draw" pathLength={1} style={d(250)} d="M48 66C40 76 22 78 8 92" strokeWidth={1.6} />
    <g className="m-swing" style={{ transformOrigin: "50% 60%" }}>
      <path d="M48 8l26 30-26 32-26-32z" fill={C.saffron} />
      <path d="M48 8l26 30-26 32z" fill={C.gold} />
      <path d="M48 8v62M24 36c10-7 38-7 48 0" strokeWidth={1.8} />
      <path d="M48 70l-7 10h14z" fill={C.pink} />
    </g>
  </>
);

const Tricolour = () => {
  const flags = [C.saffron, C.white, C.green, C.saffron, C.white, C.green];
  return (
    <>
      <path d="M4 18c28 18 60 18 88 0" strokeWidth={1.8} />
      {flags.map((f, i) => {
        const x = 12 + i * 14.4;
        const y = 18 + Math.sin(((x - 4) / 88) * Math.PI) * 13.5;
        return (
          <g key={i} className="m-drop" style={d(i * 70)}>
            <path d={`M${x - 6} ${y}h12l-6 ${i % 2 ? 22 : 26}z`} fill={f} />
            {f === C.white ? <circle cx={x} cy={y + 6} r="2" fill={C.navy} stroke="none" /> : null}
          </g>
        );
      })}
    </>
  );
};

const Holi = () => (
  <>
    {[
      [26, 30, 9, C.pink, 0],
      [48, 22, 10, C.gold, 120],
      [70, 32, 8, C.sky, 240],
      [38, 14, 5, C.green, 320],
      [62, 14, 4, C.pink, 380],
    ].map(([x, y, r, c, t]) => (
      <circle key={`${x}${y}`} className="m-puff" style={d(t as number)} cx={x} cy={y} r={r} fill={c as string} stroke="none" opacity="0.55" />
    ))}
    <g className="m-pop">
      <ellipse cx="48" cy="70" rx="38" ry="11" fill={C.gold} />
      <ellipse cx="48" cy="67" rx="30" ry="6" fill="#e9b437" stroke="none" />
      <path d="M18 66c2-12 18-12 20 0z" fill={C.pink} />
      <path d="M37 64c2-14 20-14 22 0z" fill={C.green} />
      <path d="M58 66c2-12 18-12 20 0z" fill={C.sky} />
    </g>
  </>
);

const Gudi = () => (
  <g className="m-rise">
    <path d="M48 24v64" stroke={C.bamboo} strokeWidth={4.5} />
    <path d="M40 88h16" strokeWidth={3} />
    <path d="M43 27c-5 10-12 22-14 34 6 3 12-1 19 2 7-3 13 1 19-2-2-12-9-24-14-34z" fill={C.gold} />
    <path d="M31 55c6 3 11 0 17 2 6-2 11 1 17-2" stroke={C.green} strokeWidth={3.4} />
    <path d="M43 27c-5 10-12 22-14 34 6 3 12-1 19 2 7-3 13 1 19-2-2-12-9-24-14-34z" />
    <path d="M48 29v30" stroke={C.saffron} strokeWidth={2} opacity="0.7" />
    <path d="M38 24c0-10 4-16 10-16s10 6 10 16z" fill={C.clay} />
    <path d="M36 24h24" />
    <path d="M44 8h8" strokeWidth={3} />
    <path d="M36 26c-6 3-12 2-15-2 5-2 11-1 15 2zM60 26c6 3 12 2 15-2-5-2-11-1-15 2z" fill={C.leaf} />
    {[39, 43.5, 48, 52.5, 57].map((x, i) => (
      <circle key={x} cx={x} cy={28 + (i === 0 || i === 4 ? 0 : 1.5)} r="2.4" fill={i % 2 ? C.white : C.saffron} strokeWidth={1.2} />
    ))}
  </g>
);

const Crescent = () => (
  <>
    <g className="m-pop">
      <path d="M58 14a30 30 0 1 0 18 52A26 26 0 1 1 58 14z" fill={C.gold} />
    </g>
    <path className="m-twinkle" style={d(350)} d="M70 26l2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8z" fill={C.gold} strokeWidth={1.8} />
    <path className="m-twinkle" style={d(500)} d="M22 20v6M19 23h6" stroke={C.amber} />
    <path className="m-twinkle" style={d(600)} d="M80 70v6M77 73h6" stroke={C.amber} />
  </>
);

const Modak = () => {
  const one = (x: number, y: number, s: number, t: number) => (
    <g key={x} className="m-pop" style={{ ...d(t), transformOrigin: "50% 100%" }}>
      <path
        transform={`translate(${x} ${y}) scale(${s})`}
        d="M0-28c3 6 12 12 15 20 3 9-4 16-15 16S-18 1-15-8c3-8 12-14 15-20z"
        fill={C.cream}
        strokeWidth={2.2 / s}
      />
      <path transform={`translate(${x} ${y}) scale(${s})`} d="M0-26v32M-7-14c-3 6-3 13 0 19M7-14c3 6 3 13 0 19" strokeWidth={1.4 / s} opacity="0.6" />
    </g>
  );
  return (
    <>
      <ellipse cx="48" cy="80" rx="38" ry="9" fill={C.gold} />
      {one(28, 74, 0.8, 120)}
      {one(68, 74, 0.8, 220)}
      {one(48, 70, 1.05, 0)}
    </>
  );
};

const Toran = () => (
  <>
    <path d="M4 14h88" strokeWidth={1.8} />
    {Array.from({ length: 7 }, (_, i) => {
      const x = 10 + i * 12.6;
      return i % 2 ? (
        <path key={i} className="m-drop" style={d(i * 60)} d={`M${x} 14c-6 8-6 18 0 24 6-6 6-16 0-24z`} fill={C.leaf} />
      ) : (
        <g key={i} className="m-drop" style={d(i * 60)}>
          <path d={`M${x} 14v6`} strokeWidth={1.4} />
          <circle cx={x} cy={28} r="8" fill={C.saffron} />
          <circle cx={x} cy={28} r="4" fill={C.gold} stroke="none" />
          <circle cx={x} cy={44} r="5.5" fill={C.gold} />
        </g>
      );
    })}
  </>
);

const Joining = () => (
  <>
    <g className="m-pop" style={{ transformOrigin: "0% 100%" }}>
      <path d="M14 86l14-42 28 28z" fill={C.forest} />
      <path d="M21 65l13 13M25 54l19 19" stroke={C.sage} strokeWidth={3} />
      <path d="M14 86l14-42 28 28z" />
    </g>
    <path className="m-draw" pathLength={1} style={d(150)} d="M44 50c2-10 10-12 12-20s-4-12 2-18" stroke={C.pink} strokeWidth={2.6} />
    <path className="m-draw" pathLength={1} style={d(250)} d="M52 58c8-4 14 2 22-2s8-12 14-12" stroke={C.gold} strokeWidth={2.6} />
    <path className="m-draw" pathLength={1} style={d(350)} d="M48 54c6-6 6-14 14-20" stroke={C.sky} strokeWidth={2.6} />
    {[
      [70, 18, C.pink, 420],
      [84, 30, C.sage, 500],
      [36, 26, C.gold, 460],
      [80, 66, C.sky, 540],
    ].map(([x, y, c, t]) => (
      <g key={`${x}${y}`} className="m-twinkle" style={d(t as number)}>
        <rect x={x as number} y={y as number} width="5" height="5" rx="1" fill={c as string} stroke="none" transform={`rotate(25 ${x} ${y})`} />
      </g>
    ))}
  </>
);

const Trophy = () => (
  <>
    <g className="m-pop">
      <path d="M30 20c-12 0-14 18 4 22M66 20c12 0 14 18-4 22" strokeWidth={3} />
      <path d="M28 14h40v14c0 14-9 24-20 24S28 42 28 28z" fill={C.gold} />
      <path d="M48 52v12" strokeWidth={4} />
      <path d="M36 64h24l3 8H33z" fill={C.forest} />
      <path d="M30 72h36v8H30z" fill={C.forest} />
      <path d="M48 22l3 6 6.5 1-4.7 4.6 1.1 6.4-5.9-3.1-5.9 3.1 1.1-6.4-4.7-4.6 6.5-1z" fill={C.white} strokeWidth={1.6} />
    </g>
    <path className="m-twinkle" style={d(450)} d="M78 10v8M74 14h8" stroke={C.amber} />
    <path className="m-twinkle" style={d(600)} d="M16 46v6M13 49h6" stroke={C.amber} />
  </>
);

const Hourglass = () => (
  <g className="m-pop">
    <path d="M28 10h40M28 86h40" strokeWidth={5} stroke={C.forest} />
    <path d="M32 12c0 18 14 26 14 36s-14 18-14 36h32c0-18-14-26-14-36s14-18 14-36z" fill={C.white} />
    <path d="M38 28c4 6 8 9 10 12 2-3 6-6 10-12z" fill={C.gold} stroke="none" />
    <path d="M34 84c1-9 8-14 14-16 6 2 13 7 14 16z" fill={C.gold} stroke="none" />
    <path className="m-draw" pathLength={1} style={d(200)} d="M48 48v20" stroke={C.gold} strokeWidth={1.8} />
    <path d="M32 12c0 18 14 26 14 36s-14 18-14 36h32c0-18-14-26-14-36s14-18 14-36z" />
  </g>
);

const Rain = () => (
  <>
    {[
      [18, 18, 0],
      [80, 14, 140],
      [12, 52, 260],
      [86, 48, 80],
      [70, 4, 320],
    ].map(([x, y, t]) => (
      <path key={`${x}${y}`} className="m-fall" style={d(t)} d={`M${x} ${y}c3 5 4 7 4 9a4 4 0 0 1-8 0c0-2 1-4 4-9z`} fill={C.sky} strokeWidth={1.6} />
    ))}
    <g className="m-pop">
      <path d="M48 22v56c0 6 10 6 10 0" strokeWidth={3} />
      <path d="M14 50C14 32 30 20 48 20s34 12 34 30c-5-5-12-5-17 0-5-5-12-5-17 0-5-5-12-5-17 0-5-5-12-5-17 0z" fill={C.forest} />
      <path d="M31 50c0-14 7-28 17-30 10 2 17 16 17 30-5-5-12-5-17 0-5-5-12-5-17 0z" fill={C.sage} />
      <path d="M48 20v-5" strokeWidth={3} />
    </g>
  </>
);

const ART: Record<MomentKind, () => ReactNode> = {
  diya: Diya,
  star: Star,
  sparkler: Sparkler,
  kite: Kite,
  tricolour: Tricolour,
  holi: Holi,
  gudi: Gudi,
  crescent: Crescent,
  modak: Modak,
  toran: Toran,
  joining: Joining,
  trophy: Trophy,
  hourglass: Hourglass,
  rain: Rain,
};

export function Illustration({ kind, label }: { kind: MomentKind; label: string }) {
  const Art = ART[kind];
  return (
    <Svg label={label}>
      <Art />
    </Svg>
  );
}

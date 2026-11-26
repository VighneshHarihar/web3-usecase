/** Outline icons, 1.75 stroke (Lucide-style, drawn for LoyalLink). */
const P: Record<string, string> = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M20 20l-3.5-3.5',
  gift: 'M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z M3 7h18v4H3z M12 7v14 M12 7c-2-4-6-3.5-6-1s4 1 6 1 M12 7c2-4 6-3.5 6-1s-4 1-6 1',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M4 21a8 8 0 0 1 16 0',
  qr: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h3v3 M21 14v3h-4 M14 21h3v-3 M21 21v-3',
  pin: 'M12 21s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13z M12 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3.5 2',
  check: 'M4 12l5 5L20 6',
  checkCircle: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8 12.5l3 3 5-6',
  chevron: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  down: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12 M18 6L6 18',
  shield: 'M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z M8.5 12l2.5 2.5L15.5 10',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 8v.01 M11 12h1v5h1',
  alert: 'M12 3l10 18H2z M12 10v4 M12 17v.01',
  bell: 'M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z M10 21a2 2 0 0 0 4 0',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  store: 'M3 9l2-5h14l2 5 M3 9v11h18V9 M3 9h18 M9 20v-6h6v6',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3 M16 4h3a1 1 0 0 1 1 1v3 M20 16v3a1 1 0 0 1-1 1h-3 M8 20H5a1 1 0 0 1-1-1v-3 M4 12h16',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4 M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-1z M17 13.5h.01',
  chart: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  users: 'M9 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M2 21a7 7 0 0 1 14 0 M16 4.5a4 4 0 0 1 0 7 M18 14a6 6 0 0 1 4 7',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M4.9 19.1L7 17 M17 7l2.1-2.1',
  tag: 'M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z M8 8h.01',
  pause: 'M8 5v14 M16 5v14',
  play: 'M7 4l13 8-13 8z',
  stop: 'M6 6h12v12H6z',
  edit: 'M4 20h4L19 9l-4-4L4 16z M14 6l4 4',
  logout: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4 M10 16l4-4-4-4 M14 12H4',
  download: 'M12 4v11 M7 10l5 5 5-5 M4 20h16',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c3 3.5 3 14.5 0 18 M12 3c-3 3.5-3 14.5 0 18',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  printer: 'M7 9V3h10v6 M7 17H4v-7h16v7h-3 M7 14h10v7H7z',
  external: 'M14 4h6v6 M20 4l-9 9 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  copy: 'M9 9h11v11H9z M5 15H4V4h11v1',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4z M12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  keypad: 'M6 5h.01 M12 5h.01 M18 5h.01 M6 11h.01 M12 11h.01 M18 11h.01 M6 17h.01 M12 17h.01 M18 17h.01',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6',
  undo: 'M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3',
  sparkles: 'M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z',
  lock: 'M6 11h12v10H6z M8 11V7a4 4 0 0 1 8 0v4',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  coffee: 'M5 8h12v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z M17 10h2a2 2 0 0 1 0 4h-2 M7 3v2 M11 3v2 M15 3v2',
  pizza: 'M12 3l9 17H3z M10 13h.01 M14 13h.01 M12 17h.01',
  bag: 'M5 8h14l-1 12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z M9 8V6a3 3 0 0 1 6 0v2',
  cake: 'M4 21h16 M5 21v-7h14v7 M6 14V9h12v5 M9 9V5 M12 9V4 M15 9V5',
  basket: 'M3 10h18l-2 10H5z M7 10l4-6 M17 10l-4-6 M9 14v3 M15 14v3',
  pill: 'M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7z M7 10l7 7',
  scissors: 'M6 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M6 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M8.5 8.5L20 20 M8.5 15.5L20 4',
  wrench: 'M14 6a4 4 0 0 0 5 5l-9 9a2 2 0 0 1-3-3l9-9a4 4 0 0 0-2-2z',
};

export function Icon({ name, size = 22, className = '', stroke = 1.75 }: { name: string; size?: number; className?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true">
      <path d={P[name] ?? P.info} />
    </svg>
  );
}

export const CATEGORY_STYLE: Record<string, { icon: string; tint: string; ink: string }> = {
  grocery: { icon: 'basket', tint: '#E4ECE2', ink: '#3A5A3A' },
  food: { icon: 'pizza', tint: '#FBE3D9', ink: '#9A3A1D' },
  coffee: { icon: 'coffee', tint: '#EDE3D6', ink: '#5A3E22' },
  bakery: { icon: 'cake', tint: '#F4E6D2', ink: '#7A5320' },
  retail: { icon: 'bag', tint: '#EDE6DA', ink: '#5A4A2E' },
  pharmacy: { icon: 'pill', tint: '#E2ECEE', ink: '#2E5A60' },
  salon: { icon: 'scissors', tint: '#F3E2EA', ink: '#7A2E52' },
  services: { icon: 'wrench', tint: '#E6E4EE', ink: '#3E3A60' },
  other: { icon: 'store', tint: '#EFEAE0', ink: '#4A4238' },
};

export function ShopGlyph({ category, size = 44 }: { category: string; size?: number }) {
  const s = CATEGORY_STYLE[category] ?? CATEGORY_STYLE.other;
  return (
    <div className="grid place-items-center shrink-0" style={{ width: size, height: size, borderRadius: size * 0.32, background: s.tint, color: s.ink }} aria-hidden="true">
      <Icon name={s.icon} size={Math.round(size * 0.55)} stroke={1.8} />
    </div>
  );
}

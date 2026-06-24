// Small inline platform marks for the export-target dropdown.
export type Platform = 'compose' | 'android' | 'svg' | 'react' | 'js' | 'apple';

export function PlatformIcon({ k }: { k: Platform }) {
  const c = { width: 16, height: 16, viewBox: '0 0 24 24', style: { flex: 'none' as const } };
  switch (k) {
    case 'compose': // Kotlin mark
      return (
        <svg {...c}><defs><linearGradient id="pk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7F52FF" /><stop offset="1" stopColor="#E24462" /></linearGradient></defs>
          <path d="M3 3h18L12 12l9 9H3z" fill="url(#pk)" /></svg>
      );
    case 'android':
      return (
        <svg {...c} fill="#3DDC84"><path d="M5 10a7 7 0 0114 0v7H5z" /><rect x="3" y="11" width="2.2" height="6" rx="1.1" /><rect x="18.8" y="11" width="2.2" height="6" rx="1.1" />
          <circle cx="9.3" cy="12" r="1" fill="#0B0B0D" /><circle cx="14.7" cy="12" r="1" fill="#0B0B0D" /></svg>
      );
    case 'react':
      return (
        <svg {...c} fill="none" stroke="#61DAFB" strokeWidth="1.1"><circle cx="12" cy="12" r="1.8" fill="#61DAFB" stroke="none" />
          <ellipse cx="12" cy="12" rx="10" ry="4" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" /></svg>
      );
    case 'svg':
      return (
        <svg {...c} fill="none" stroke="#FFB13B" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c3.2 3 3.2 15 0 18M12 3c-3.2 3-3.2 15 0 18" /></svg>
      );
    case 'js':
      return (
        <svg {...c}><rect width="24" height="24" rx="4" fill="#F7DF1E" /><text x="12" y="17" fontSize="10" fontWeight="700" textAnchor="middle" fill="#0B0B0D" fontFamily="ui-monospace, monospace">JS</text></svg>
      );
    case 'apple':
      return (
        <svg {...c} fill="currentColor"><path d="M16 12.5c0-2 1.6-3 1.7-3a3.7 3.7 0 00-2.9-1.6c-1.2-.1-2.4.7-3 .7s-1.6-.7-2.6-.7A3.9 3.9 0 005 9.9c-1.5 2.7-.4 6.6 1.1 8.8.7 1 1.6 2.2 2.7 2.2s1.4-.7 2.7-.7 1.6.7 2.7.7 1.9-1 2.6-2.1a8.6 8.6 0 001.2-2.4 3.7 3.7 0 01-2.7-3.6z" /><path d="M14 6.3a3.5 3.5 0 00.9-2.5 3.6 3.6 0 00-2.3 1.2 3.3 3.3 0 00-.9 2.4 3 3 0 002.3-1.1z" /></svg>
      );
  }
}

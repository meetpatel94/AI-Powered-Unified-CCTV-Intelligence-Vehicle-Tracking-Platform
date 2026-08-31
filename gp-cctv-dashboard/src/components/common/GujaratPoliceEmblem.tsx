interface EmblemProps {
  size?: number;
  className?: string;
}

/**
 * Stylised Gujarat Police emblem badge (state police crest placeholder).
 * Drawn as inline SVG so it stays crisp and needs no network fetch.
 */
export function GujaratPoliceEmblem({ size = 34, className = '' }: EmblemProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Gujarat Police emblem"
    >
      <defs>
        <linearGradient id="gp-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f4d68a" />
          <stop offset="45%" stopColor="#c9a34a" />
          <stop offset="100%" stopColor="#8a6a24" />
        </linearGradient>
        <radialGradient id="gp-badge" cx="50%" cy="34%" r="70%">
          <stop offset="0%" stopColor="#1d4ed8" />
          <stop offset="60%" stopColor="#12306e" />
          <stop offset="100%" stopColor="#0a1b3f" />
        </radialGradient>
      </defs>

      <circle cx="32" cy="32" r="30" fill="url(#gp-ring)" />
      <circle cx="32" cy="32" r="26.5" fill="url(#gp-badge)" />
      <circle cx="32" cy="32" r="26.5" fill="none" stroke="#0a1b3f" strokeWidth="1" opacity="0.6" />

      {/* laurel wreath */}
      <path
        d="M18 40c-4-6-4-14 1-20M46 40c4-6 4-14-1-20"
        fill="none"
        stroke="#e8c874"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {[0, 1, 2, 3].map((i) => (
        <g key={i} fill="#e8c874" opacity="0.9">
          <ellipse cx={17.5 - 0.4 * i} cy={35 - i * 5} rx="2.4" ry="1.3" transform={`rotate(${-38 - i * 6} ${17.5 - 0.4 * i} ${35 - i * 5})`} />
          <ellipse cx={46.5 + 0.4 * i} cy={35 - i * 5} rx="2.4" ry="1.3" transform={`rotate(${38 + i * 6} ${46.5 + 0.4 * i} ${35 - i * 5})`} />
        </g>
      ))}

      {/* central star */}
      <path
        d="M32 13l4.4 9.4 10.2 1.4-7.4 7.2 1.8 10.2L32 36.4l-9 4.8 1.8-10.2-7.4-7.2 10.2-1.4z"
        fill="#f2d691"
        stroke="#8a6a24"
        strokeWidth="0.7"
      />
      <circle cx="32" cy="26" r="3.4" fill="#12306e" stroke="#f2d691" strokeWidth="0.8" />

      {/* scroll / banner */}
      <path d="M14 46h36l-4 6H18z" fill="#0d2a63" stroke="#e8c874" strokeWidth="1.1" />
      <text
        x="32"
        y="50.8"
        textAnchor="middle"
        fontSize="5.2"
        fontWeight="700"
        fill="#f2d691"
        letterSpacing="0.4"
      >
        GUJARAT
      </text>
    </svg>
  );
}

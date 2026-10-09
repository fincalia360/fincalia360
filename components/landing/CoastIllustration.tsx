/** Ilustración abstracta del litoral del Empordà (SVG propio, sin imágenes externas). */
export function CoastIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 520" className={className} role="img" aria-label="Ilustración de la costa">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EAF5F3" />
          <stop offset="1" stopColor="#F7F8F5" />
        </linearGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#445B74" />
          <stop offset="1" stopColor="#142B45" />
        </linearGradient>
        <clipPath id="frame">
          <rect x="0" y="0" width="640" height="520" rx="28" />
        </clipPath>
      </defs>
      <g clipPath="url(#frame)">
        <rect width="640" height="520" fill="url(#sky)" />
        <circle cx="455" cy="150" r="62" fill="#3A9A8C" opacity="0.85" />
        <circle cx="455" cy="150" r="92" fill="none" stroke="#3A9A8C" strokeOpacity="0.25" />
        {/* Sierra de Rodes / Cap de Creus */}
        <path d="M0 268 C70 220 120 238 170 214 C230 186 270 214 318 198 C372 180 420 214 470 206 C530 196 590 226 640 214 L640 330 L0 330Z" fill="#7FB5AC" opacity="0.55" />
        <path d="M0 300 C60 268 110 280 160 262 C220 240 262 270 320 258 C380 246 430 276 500 270 C560 264 600 286 640 280 L640 340 L0 340Z" fill="#238477" opacity="0.9" />
        {/* Pueblo blanco */}
        <g fill="#F7F8F5" stroke="#142B45" strokeOpacity="0.15">
          <rect x="96" y="272" width="22" height="20" />
          <rect x="120" y="266" width="18" height="26" />
          <rect x="140" y="276" width="26" height="16" />
          <rect x="168" y="262" width="14" height="30" />
          <path d="M172 262 L175 248 L178 262Z" />
          <rect x="184" y="274" width="24" height="18" />
        </g>
        {/* Mar */}
        <rect y="292" width="640" height="228" fill="url(#sea)" />
        <g stroke="#EFF1EC" strokeLinecap="round" fill="none">
          <path d="M40 330 h70 M150 344 h40 M260 326 h90 M420 338 h60 M520 322 h70" strokeOpacity="0.35" strokeWidth="2" />
          <path d="M80 380 h110 M250 396 h60 M360 372 h120 M520 392 h80" strokeOpacity="0.22" strokeWidth="2" />
          <path d="M20 440 h80 M160 452 h140 M360 436 h70 M480 456 h120" strokeOpacity="0.14" strokeWidth="2" />
        </g>
        {/* Reflejo del sol */}
        <g stroke="#3A9A8C" strokeLinecap="round" strokeWidth="3" opacity="0.55">
          <path d="M425 312 h60" />
          <path d="M435 326 h40" />
          <path d="M445 340 h20" />
        </g>
        {/* Velero */}
        <g transform="translate(300 300)">
          <path d="M0 0 L0 -46 L26 0Z" fill="#F7F8F5" />
          <path d="M-4 0 L-4 -34 L-22 0Z" fill="#E3E6E1" />
          <path d="M-26 4 h56 l-8 8 h-40Z" fill="#F7F8F5" />
        </g>
      </g>
    </svg>
  );
}

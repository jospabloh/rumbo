import React from "react";

// Logo de Apple, monocromo (hereda el color del texto del botón).
export default function AppleIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.42 2.2-1.13 3.02-.8.92-2.13 1.63-3.27 1.54-.14-1.1.43-2.27 1.1-3 .76-.83 2.1-1.46 3.3-1.56zM20.9 17.1c-.55 1.27-.81 1.84-1.52 2.96-.99 1.57-2.39 3.52-4.12 3.53-1.54.02-1.94-1-4.03-.99-2.09.01-2.53 1.01-4.07.99-1.73-.02-3.06-1.78-4.05-3.34-2.77-4.37-3.06-9.5-1.35-12.22 1.21-1.94 3.13-3.08 4.93-3.08 1.84 0 2.99 1.01 4.51 1.01 1.47 0 2.37-1.01 4.5-1.01 1.6 0 3.29.87 4.5 2.38-3.95 2.17-3.31 7.8.27 9.78z" />
    </svg>
  );
}

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

/**
 * Light/dark toggle for the sidebar footer. Mounted guard avoids rendering the
 * wrong icon before next-themes has read the stored preference.
 */
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';
  const next = isDark ? 'light' : 'dark';
  const label = isDark ? 'Tema claro' : 'Tema oscuro';

  return (
    <button
      onClick={() => setTheme(next)}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent w-full transition-all"
      aria-label={mounted ? `Cambiar a ${label.toLowerCase()}` : 'Cambiar tema'}
    >
      {mounted && isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      <span>{mounted ? label : 'Tema'}</span>
    </button>
  );
}

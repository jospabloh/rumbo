import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandShortcut,
} from '@/components/ui/command';
import { accessibleNavItems } from '@/lib/nav';

/**
 * Paleta de comandos (⌘K / Ctrl+K) para navegación rápida.
 *
 * Reúne en un solo buscador todos los destinos a los que el rol tiene acceso
 * —usando el mismo registro `accessibleNavItems` que la barra lateral, así que
 * nunca ofrece una sección prohibida— más un par de acciones rápidas (cambiar
 * tema). Es el atajo "premium" para moverse sin tocar el mouse.
 *
 * @param {{ open: boolean, onOpenChange: (v: boolean) => void, role: string, isAppOwner?: boolean }} props
 */
export default function CommandPalette({ open, onOpenChange, role, isAppOwner = false }) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  const run = useCallback((fn) => {
    onOpenChange(false);
    fn();
  }, [onOpenChange]);

  const items = accessibleNavItems(role, { isAppOwner });

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar sección o acción…" />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>
        <CommandGroup heading="Ir a">
          {items.map((item) => (
            <CommandItem key={item.path} value={item.label} onSelect={() => run(() => navigate(item.path))}>
              <item.icon className="mr-2" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Acciones">
          <CommandItem
            value="Cambiar tema claro oscuro"
            onSelect={() => run(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? <Sun className="mr-2" /> : <Moon className="mr-2" />}
            Cambiar a tema {theme === 'dark' ? 'claro' : 'oscuro'}
            <CommandShortcut>tema</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

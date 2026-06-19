import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const WIDTHS = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' };

/**
 * Bottom-sheet on mobile, centered dialog on desktop. Centralizes the
 * overlay + sheet shell that was hand-copied across every modal in the app.
 *
 * @param {{
 *   title: React.ReactNode,
 *   onClose: () => void,
 *   maxWidth?: 'sm' | 'md' | 'lg',
 *   scroll?: boolean,
 *   children: React.ReactNode,
 * }} props
 */
export default function ResponsiveModal({ title, onClose, maxWidth = 'sm', scroll = false, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={cn(
        'relative z-10 w-full bg-card border border-border rounded-t-2xl lg:rounded-2xl p-6',
        WIDTHS[maxWidth],
        scroll && 'max-h-[90vh] overflow-y-auto',
      )}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

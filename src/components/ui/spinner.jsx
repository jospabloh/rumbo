import { cn } from '@/lib/utils';

const SIZES = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-4',
};

/**
 * Single source of truth for the app's loading spinner. Previously this same
 * `border-primary border-t-transparent animate-spin` markup was hand-copied in
 * ~20 places with slightly different sizes.
 */
/** @param {{ size?: 'sm'|'md'|'lg', className?: string }} props */
export function Spinner({ size = 'md', className }) {
  return (
    <div
      role="status"
      aria-label="Cargando"
      className={cn('rounded-full border-primary border-t-transparent animate-spin', SIZES[size], className)}
    />
  );
}

/**
 * Centered, full-height loader for page-level loading states.
 * @param {{ className?: string }} props
 */
export function PageLoader({ className }) {
  return (
    <div className={cn('flex items-center justify-center h-full', className)}>
      <Spinner />
    </div>
  );
}

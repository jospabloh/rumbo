import { cn } from '@/lib/utils';

/**
 * Inline form error message. Renders nothing when there's no message, so call
 * sites can drop the `{error && ...}` guard: `<FormError>{error}</FormError>`.
 *
 * @param {{ children?: React.ReactNode, className?: string }} props
 */
export function FormError({ children, className }) {
  if (!children) return null;
  return <p className={cn('text-sm text-destructive', className)}>{children}</p>;
}

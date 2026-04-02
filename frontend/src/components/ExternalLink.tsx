import { cn } from '@/lib/utils';

export function ExternalLink({ href, className, children, ...props }: React.ComponentProps<'a'>) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('hover:text-foreground hover:underline', className)}
      {...props}
    >
      {children ?? href}
    </a>
  );
}

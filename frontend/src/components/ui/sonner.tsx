import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'group bg-card text-card-foreground border border-border shadow-lg rounded-lg text-sm',
          description: 'text-muted-foreground text-xs',
          actionButton: 'bg-primary text-primary-foreground text-xs',
          cancelButton: 'bg-muted text-muted-foreground text-xs',
          error: 'border-destructive/50 bg-destructive/10 text-destructive',
          success: 'border-green-800/50 bg-green-950/40 text-green-400',
          info: 'border-border',
        },
      }}
    />
  );
}

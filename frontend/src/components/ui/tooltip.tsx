import * as React from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export const Tooltip: React.FC<TooltipProps> = ({ children, content, side = 'top' }) => {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {children}
      </div>
      {open && (
        <div
          className={cn(
            'absolute z-50 rounded-md bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md',
            {
              'bottom-full left-1/2 -translate-x-1/2 -translate-y-1': side === 'top',
              'top-full left-1/2 -translate-x-1/2 translate-y-1': side === 'bottom',
              'right-full top-1/2 -translate-x-1 -translate-y-1/2': side === 'left',
              'left-full top-1/2 translate-x-1 -translate-y-1/2': side === 'right',
            }
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
};

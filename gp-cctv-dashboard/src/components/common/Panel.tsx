import type { ReactNode } from 'react';

interface PanelProps {
  title?: string;
  action?: ReactNode;
  /** Icons or controls rendered at the right edge of the panel header. */
  tools?: ReactNode;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  children: ReactNode;
}

/**
 * Standard command-center panel: thin blue-gray border, dark navy body and a
 * compact uppercase header. Used by every dashboard module for grid alignment.
 */
export function Panel({
  title,
  action,
  tools,
  className = '',
  bodyClassName = '',
  headerClassName = '',
  children,
}: PanelProps) {
  return (
    <section className={`panel flex min-h-0 flex-col ${className}`}>
      {(title || action || tools) && (
        <header
          className={`flex shrink-0 items-center justify-between gap-2 px-3 pb-1.5 pt-2.5 ${headerClassName}`}
        >
          {title ? <h2 className="panel-title">{title}</h2> : <span />}
          <div className="flex items-center gap-2">
            {tools}
            {action}
          </div>
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

interface ViewAllProps {
  label?: string;
  onClick?: () => void;
}

export function ViewAll({ label = 'View All', onClick }: ViewAllProps) {
  return (
    <button type="button" onClick={onClick} className="link-action">
      {label}
    </button>
  );
}

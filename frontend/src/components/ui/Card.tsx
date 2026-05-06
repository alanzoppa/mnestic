import { ReactNode, MouseEventHandler, KeyboardEventHandler } from 'react';
import { twMerge } from 'tailwind-merge';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  elevated?: boolean;
  topBorder?: 'blue' | 'emerald' | 'purple' | 'amber';
  onClick?: MouseEventHandler<HTMLDivElement>;
  'data-testid'?: string;
}

export function Card({ 
  children, 
  className = '', 
  hover = false, 
  elevated = false,
  topBorder,
  onClick, 
  'data-testid': dataTestId 
}: CardProps) {
  const baseClasses = hover ? 'card-hover' : 'card';
  const cursorClass = onClick ? 'cursor-pointer' : '';
  const elevatedClass = elevated ? 'shadow-lg shadow-black/20' : '';
  const borderClass = topBorder ? `border-t-${topBorder}` : '';

  const handleKeyDown: KeyboardEventHandler<HTMLDivElement> | undefined = onClick ? (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
    }
  } : undefined;

  return (
    <div 
      className={twMerge(baseClasses, cursorClass, elevatedClass, borderClass, className)}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      data-testid={dataTestId}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`px-5 py-4 border-b border-zinc-800/60 ${className}`}>
      {children}
    </div>
  );
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export function CardTitle({ children, className = '' }: CardTitleProps) {
  return (
    <h3 className={`text-lg font-semibold text-zinc-100 tracking-tight ${className}`}>
      {children}
    </h3>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return (
    <div className={`p-5 ${className}`}>
      {children}
    </div>
  );
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`px-5 py-4 border-t border-zinc-800/60 ${className}`}>
      {children}
    </div>
  );
}
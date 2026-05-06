interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  accent?: boolean;
}

export function SectionHeader({ title, description, action, accent = false }: SectionHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 animate-fade-up">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-[1.75rem] font-extrabold text-zinc-100 tracking-tight leading-tight">
            {title}
          </h1>
        </div>
        {accent && (
          <div className="mt-3 h-[2px] w-10 bg-blue-500 rounded-full" />
        )}
        {description && (
          <p className="mt-2 text-sm text-zinc-400 font-normal leading-relaxed max-w-xl">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex-shrink-0">{action}</div>
      )}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-zinc-500">{description}</p>
        )}
      </div>
      {action && (
        <div>{action}</div>
      )}
    </div>
  );
}

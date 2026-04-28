import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { HighlightText } from '@/components/HighlightText';
import { STRUCTURAL_TAGS } from '@/lib/constants';

import { format, parseISO, isValid } from 'date-fns';

function formatCreatedDate(created: string) {
  const d = parseISO(created);
  return isValid(d) ? format(d, 'MMMM d, yyyy') : created;
}

interface NoteResultProps {
  title: string;
  source?: string;
  folder?: string;
  created?: string;
  date?: string;
  tags?: string[];
  snippet?: string;
  score?: number;
  type?: 'note' | 'calendar';
  showScore?: boolean;
  href?: string;
  highlightQuery?: string;
}

export function NoteResult({
  title,
  source,
  folder,
  created,
  date,
  tags = [],
  snippet,
  score,
  type = 'note',
  showScore = false,
  href,
  highlightQuery,
}: NoteResultProps) {
  const isHandwritten = tags.includes('handwritten');
  const displayTags = tags.filter((t) => !STRUCTURAL_TAGS.includes(t));

  const content = (
    <>
      {/* Meta line */}
      <div className="flex items-center gap-2 mb-2">
        <Badge variant={type === 'calendar' ? 'purple' : 'blue'}>
          {source || (type === 'calendar' ? 'Calendar' : 'Unknown')}
        </Badge>
        {folder && (
          <>
            <span className="text-zinc-600">·</span>
            <Badge variant="zinc">{folder}</Badge>
          </>
        )}
        {isHandwritten && (
          <>
            <span className="text-zinc-600">·</span>
            <Badge variant="amber">Handwritten</Badge>
          </>
        )}
        {showScore && score !== undefined && (
          <span className="text-xs text-zinc-500 ml-2">
            Score: {score.toFixed(2)}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-semibold text-zinc-100 text-lg group-hover:text-blue-400 transition-colors">
        {highlightQuery ? (
          <HighlightText text={title || 'Untitled'} query={highlightQuery} />
        ) : (
          title || 'Untitled'
        )}
      </h3>

      {/* Date */}
      {created && (
        <p className="text-sm text-zinc-500 mt-1">
          {formatCreatedDate(created)}
        </p>
      )}

      {/* Snippet */}
      {snippet && (
        <p className="text-sm text-zinc-400 mt-3 line-clamp-2">
          {highlightQuery ? (
            <HighlightText text={snippet} query={highlightQuery} />
          ) : (
            snippet.substring(0, 150)
          )}
        </p>
      )}

      {/* Tags */}
      {displayTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4">
          {displayTags.slice(0, 6).map((tag) => (
            <Badge key={tag} variant={STRUCTURAL_TAGS.includes(tag) ? 'blue' : 'green'} size="sm">
              {tag}
            </Badge>
          ))}
          {displayTags.length > 6 && (
            <span className="text-zinc-500 text-xs">
              +{displayTags.length - 6}
            </span>
          )}
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="block no-underline group">
        {content}
      </Link>
    );
  }

  return content;
}

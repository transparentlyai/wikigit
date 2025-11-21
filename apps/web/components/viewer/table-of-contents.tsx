'use client';

import { useMemo } from 'react';

interface TableOfContentsProps {
  content: string;
}

interface Heading {
  level: number;
  text: string;
  id: string;
}

export function TableOfContents({ content }: TableOfContentsProps) {
  const headings = useMemo(() => extractHeadings(content), [content]);

  if (headings.length === 0) {
    return null;
  }

  return (
    <div className="toc">
      <div className="toc-title">Contents</div>
      <ul className="toc-list">
        {headings.map((heading, index) => (
          <li
            key={index}
            className={`toc-level-${heading.level}`}
          >
            <a href={`#${heading.id}`}>{heading.text}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    // Match h2 (##) and h3 (###) headings
    const h2Match = line.match(/^##\s+(.+)$/);
    const h3Match = line.match(/^###\s+(.+)$/);

    if (h2Match) {
      const text = h2Match[1].trim();
      headings.push({
        level: 2,
        text,
        id: slugify(text),
      });
    } else if (h3Match) {
      const text = h3Match[1].trim();
      headings.push({
        level: 3,
        text,
        id: slugify(text),
      });
    }
  }

  return headings;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

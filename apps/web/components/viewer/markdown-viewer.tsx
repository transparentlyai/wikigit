'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ComponentPropsWithoutRef, useEffect, useState } from 'react';
import { bundledLanguages, codeToHtml } from 'shiki';

interface MarkdownViewerProps {
  content: string;
}

interface CodeBlockProps extends ComponentPropsWithoutRef<'code'> {
  inline?: boolean;
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock,
          // Task list items
          input: (props) => {
            if (props.type === 'checkbox') {
              return (
                <input
                  type="checkbox"
                  checked={props.checked}
                  disabled
                  style={{ marginRight: '0.5em' }}
                />
              );
            }
            return <input {...props} />;
          },
          // Generate IDs for headings to support anchor links
          h1: ({ children, ...props }) => {
            const id = slugify(String(children));
            return <h1 id={id} {...props}>{children}</h1>;
          },
          h2: ({ children, ...props }) => {
            const id = slugify(String(children));
            return <h2 id={id} {...props}>{children}</h2>;
          },
          h3: ({ children, ...props }) => {
            const id = slugify(String(children));
            return <h3 id={id} {...props}>{children}</h3>;
          },
          h4: ({ children, ...props }) => {
            const id = slugify(String(children));
            return <h4 id={id} {...props}>{children}</h4>;
          },
          h5: ({ children, ...props }) => {
            const id = slugify(String(children));
            return <h5 id={id} {...props}>{children}</h5>;
          },
          h6: ({ children, ...props }) => {
            const id = slugify(String(children));
            return <h6 id={id} {...props}>{children}</h6>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ inline, className, children, ...props }: CodeBlockProps) {
  const [html, setHtml] = useState<string>('');
  const match = /language-(\w+)/.exec(className || '');
  const language = match?.[1];

  useEffect(() => {
    if (!inline && language) {
      const code = String(children).replace(/\n$/, '');

      // Check if language is supported by Shiki
      if (language in bundledLanguages) {
        codeToHtml(code, {
          lang: language,
          theme: 'github-light',
        })
          .then((result) => setHtml(result))
          .catch(() => {
            // Fallback to plain code if highlighting fails
            setHtml(`<pre><code>${escapeHtml(code)}</code></pre>`);
          });
      } else {
        // Language not supported, use plain formatting
        setHtml(`<pre><code>${escapeHtml(code)}</code></pre>`);
      }
    }
  }, [children, language, inline]);

  if (inline) {
    return <code className={className} {...props}>{children}</code>;
  }

  if (html) {
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }

  // Fallback while loading
  return (
    <pre>
      <code className={className} {...props}>
        {children}
      </code>
    </pre>
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

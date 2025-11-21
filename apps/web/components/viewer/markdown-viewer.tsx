'use client';

/**
 * Markdown Viewer with flat design and GitHub Dark code theme
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ComponentPropsWithoutRef, useEffect, useState } from 'react';
import { bundledLanguages, codeToHtml } from 'shiki';
import { Hash, Copy } from 'lucide-react';

interface MarkdownViewerProps {
  content: string;
}

interface CodeBlockProps extends ComponentPropsWithoutRef<'code'> {
  inline?: boolean;
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="prose max-w-4xl">
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
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                />
              );
            }
            return <input {...props} />;
          },
          // Generate IDs for headings with hash anchor links
          h1: ({ children, ...props }) => {
            const id = slugify(String(children));
            return <h1 id={id} {...props}>{children}</h1>;
          },
          h2: ({ children, ...props }) => {
            const id = slugify(String(children));
            return (
              <h2 id={id} {...props} className="group cursor-pointer flex items-center gap-2">
                {children}
                <a href={`#${id}`} className="hash-anchor">
                  <Hash size={18} />
                </a>
              </h2>
            );
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
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match?.[1];

  useEffect(() => {
    if (!inline && language) {
      const code = String(children).replace(/\n$/, '');

      // Check if language is supported by Shiki
      if (language in bundledLanguages) {
        codeToHtml(code, {
          lang: language,
          theme: 'github-dark-dimmed',
        })
          .then((result) => setHtml(result))
          .catch(() => {
            // Fallback to plain code if highlighting fails
            setHtml(`<pre class="bg-[#0d1117] p-4"><code>${escapeHtml(code)}</code></pre>`);
          });
      } else {
        // Language not supported, use plain formatting with dark background
        setHtml(`<pre class="bg-[#0d1117] p-4 text-[#c9d1d9]"><code>${escapeHtml(code)}</code></pre>`);
      }
    }
  }, [children, language, inline]);

  const handleCopy = async () => {
    const code = String(children).replace(/\n$/, '');
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (inline) {
    return <code className={className} {...props}>{children}</code>;
  }

  if (html) {
    return (
      <div className="my-6 rounded-lg overflow-hidden border border-gray-200 bg-gray-50/50 shadow-sm">
        {/* Code Block Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-100/50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            {/* Mac-style dots */}
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-300"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-gray-300"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-gray-300"></div>
            </div>
            {language && (
              <span className="ml-2 text-xs font-mono text-gray-500 uppercase font-semibold tracking-wide">
                {language}
              </span>
            )}
          </div>
          <button
            onClick={handleCopy}
            className="text-gray-400 hover:text-gray-700 transition-colors"
            title="Copy code"
          >
            <Copy size={14} />
          </button>
        </div>
        {/* Code Content */}
        <div
          className="overflow-x-auto bg-[#0d1117] selection:bg-blue-500/30"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  }

  // Fallback while loading
  return (
    <pre className="my-6 rounded-lg overflow-hidden border border-gray-200 bg-[#0d1117] p-4">
      <code className={`${className} text-[#c9d1d9]`} {...props}>
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

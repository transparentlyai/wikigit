'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { remarkAlert } from 'remark-github-blockquote-alert';
import { ComponentPropsWithoutRef, useEffect, useState } from 'react';
import { bundledLanguages, codeToHtml } from 'shiki';
import { Hash, Copy } from 'lucide-react';
import { Callout } from '@/components/ui/callout';

interface MarkdownViewerProps {
  content: string;
}

interface CodeBlockProps extends ComponentPropsWithoutRef<'code'> {
  inline?: boolean;
}

function CustomDiv({ children, className, ...props }: ComponentPropsWithoutRef<'div'>) {
  if (className?.includes('markdown-alert')) {
    const alertType = className.match(/markdown-alert-(\w+)/)?.[1];

    const typeMap: Record<string, 'info' | 'warning' | 'success' | 'important' | 'caution'> = {
      'note': 'info',
      'tip': 'success',
      'important': 'important',
      'warning': 'warning',
      'caution': 'caution',
    };

    const calloutType = alertType ? typeMap[alertType] || 'info' : 'info';

    let content = children;

    if (Array.isArray(children)) {
      content = children.filter((child) => {
        if (typeof child === 'object' && child && 'props' in child) {
          const childClassName = child.props?.className;
          return !childClassName?.includes('markdown-alert-title');
        }
        return true;
      });
    }

    return (
      <Callout type={calloutType}>
        {content}
      </Callout>
    );
  }

  return <div {...props} className={className}>{children}</div>;
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="prose max-w-4xl">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkAlert]}
        components={{
          code: CodeBlock,
          pre: ({ children }) => <>{children}</>,
          div: CustomDiv,
          p: ({ children }) => {
            // Check if children contains a fenced code block
            const childrenArray = Array.isArray(children) ? children : [children];

            // Fenced code blocks have className with "language-*"
            const hasFencedCodeBlock = childrenArray.some((child: any) => {
              if (child?.type?.name === 'CodeBlock' || typeof child?.type === 'function') {
                const className = child?.props?.className;
                return className && /language-/.test(className);
              }
              return false;
            });

            if (hasFencedCodeBlock) {
              // Unwrap to avoid nesting <pre> in <p>
              return <>{children}</>;
            }

            return <p>{children}</p>;
          },
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

  // Determine if this is inline or block code
  // If inline prop is explicitly set, use it
  // Otherwise, code with a className is fenced (block), code without is inline
  const isInline = inline !== undefined ? inline : !className;

  useEffect(() => {
    if (!isInline && language) {
      const code = String(children).replace(/\n$/, '');

      if (language in bundledLanguages) {
        codeToHtml(code, {
          lang: language,
          theme: 'github-dark-dimmed',
        })
          .then((result) => {
            // Extract content between <pre> tags and strip all pre attributes
            const match = result.match(/<pre[^>]*>([\s\S]*)<\/pre>/);
            if (match) {
              setHtml(match[1]);
            } else {
              setHtml(result);
            }
          })
          .catch(() => {
            setHtml(`<code>${escapeHtml(code)}</code>`);
          });
      } else {
        setHtml(`<code class="text-[#c9d1d9]">${escapeHtml(code)}</code>`);
      }
    }
  }, [children, language, isInline]);

  const handleCopy = async () => {
    const code = String(children).replace(/\n$/, '');
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isInline) {
    return (
      <code
        className="px-1.5 py-0.5 rounded font-mono text-sm border"
        style={{
          backgroundColor: '#fff3e0',
          color: '#e65100',
          borderColor: '#ffcc80'
        }}
        {...props}
      >
        {children}
      </code>
    );
  }

  if (html) {
    return (
      <pre className="not-prose my-6 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-100">
          <div className="flex items-center gap-2">
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
        <div
          className="overflow-x-auto bg-[#0d1117] p-4 [&_code]:!bg-transparent [&_code]:!p-0"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </pre>
    );
  }

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

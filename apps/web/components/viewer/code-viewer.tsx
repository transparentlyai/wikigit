import { useEffect, useState } from 'react';
import { codeToHtml } from 'shiki';

interface CodeViewerProps {
  content: string;
  language?: string;
  filename: string;
}

export function CodeViewer({ content, language, filename }: CodeViewerProps) {
  const [highlightedCode, setHighlightedCode] = useState<string>('');

  useEffect(() => {
    const highlight = async () => {
      try {
        // Determine language from extension if not provided
        let lang = language;
        if (!lang) {
            const ext = filename.split('.').pop()?.toLowerCase();
            lang = ext || 'text';
        }

        const result = await codeToHtml(content, {
          lang,
          theme: 'github-dark-dimmed',
        });

        // Extract content between <pre> tags and strip all pre attributes
        // This allows us to control the container styling (background, padding, etc.) manually
        const match = result.match(/<pre[^>]*>([\s\S]*)<\/pre>/);
        if (match) {
          setHighlightedCode(match[1]);
        } else {
          setHighlightedCode(result);
        }
      } catch (error) {
        console.error('Failed to highlight code:', error);
        // Fallback to simple code block if highlighting fails
        setHighlightedCode(`<code>${content}</code>`);
      }
    };

    highlight();
  }, [content, language, filename]);

  return (
    <div className="w-full overflow-hidden rounded-md border border-gray-200">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
             <span className="text-sm font-medium text-gray-700">{filename}</span>
             <span className="text-xs text-gray-500 uppercase">{language || filename.split('.').pop()}</span>
        </div>
      <div className="overflow-x-auto bg-[#0d1117] p-4 text-sm">
        <pre
          className="[&_code]:!bg-transparent [&_code]:!p-0 text-[#c9d1d9] m-0"
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </div>
    </div>
  );
}

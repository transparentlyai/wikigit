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

        const html = await codeToHtml(content, {
          lang,
          theme: 'github-light',
        });
        setHighlightedCode(html);
      } catch (error) {
        console.error('Failed to highlight code:', error);
        // Fallback to simple pre/code
        setHighlightedCode(`<pre><code>${content}</code></pre>`);
      }
    };

    highlight();
  }, [content, language, filename]);

  return (
    <div className="w-full overflow-hidden rounded-md border border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
             <span className="text-sm font-medium text-gray-700">{filename}</span>
             <span className="text-xs text-gray-500 uppercase">{language || filename.split('.').pop()}</span>
        </div>
      <div 
        className="p-4 overflow-x-auto text-sm"
        dangerouslySetInnerHTML={{ __html: highlightedCode }} 
      />
    </div>
  );
}

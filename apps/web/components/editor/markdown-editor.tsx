'use client';

/**
 * Markdown Editor Component for WikiGit
 * Uses @mdxeditor/editor with GitHub-compatible markdown support
 */

import { useEffect, useRef } from 'react';
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  tablePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  Separator,
  type MDXEditorMethods,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { Save } from 'lucide-react';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

export function MarkdownEditor({ value, onChange, onSave }: MarkdownEditorProps) {
  const editorRef = useRef<MDXEditorMethods>(null);

  // Handle save keyboard shortcut (Ctrl+S / Cmd+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onSave]);

  return (
    <div className="editor-container">
      <MDXEditor
        ref={editorRef}
        markdown={value}
        onChange={onChange}
        plugins={[
          // Core editing plugins
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          markdownShortcutPlugin(),
          linkPlugin(),
          tablePlugin(),

          // Code blocks with syntax highlighting
          codeBlockPlugin({ defaultCodeBlockLanguage: 'javascript' }),
          codeMirrorPlugin({
            codeBlockLanguages: {
              js: 'JavaScript',
              javascript: 'JavaScript',
              ts: 'TypeScript',
              typescript: 'TypeScript',
              jsx: 'JSX',
              tsx: 'TSX',
              css: 'CSS',
              html: 'HTML',
              json: 'JSON',
              python: 'Python',
              py: 'Python',
              bash: 'Bash',
              sh: 'Shell',
              yaml: 'YAML',
              yml: 'YAML',
              markdown: 'Markdown',
              md: 'Markdown',
              sql: 'SQL',
              go: 'Go',
              rust: 'Rust',
              java: 'Java',
              c: 'C',
              cpp: 'C++',
              php: 'PHP',
              ruby: 'Ruby',
              swift: 'Swift',
              kotlin: 'Kotlin',
            },
          }),

          // Toolbar
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <Separator />
                <BoldItalicUnderlineToggles />
                <Separator />
                <BlockTypeSelect />
                <Separator />
                <CreateLink />
                <Separator />
                <ListsToggle />
                <Separator />
                <InsertTable />
                <Separator />
                <InsertThematicBreak />
                <Separator />
                <button
                  className="btn btn-primary"
                  onClick={onSave}
                  title="Save (Ctrl+S)"
                  style={{
                    marginLeft: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Save size={16} />
                  Save
                </button>
              </>
            ),
          }),
        ]}
        contentEditableClassName="prose"
      />
    </div>
  );
}

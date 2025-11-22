'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { Bold, Italic, Hash, Eye, EyeOff, Save, Strikethrough, Link2, Quote, Code, List, ListOrdered, Image as ImageIcon, Table, Minus, Info, AlertTriangle, Lightbulb, AlertCircle, OctagonAlert } from 'lucide-react';
import { MarkdownViewer } from '@/components/viewer/markdown-viewer';
import { MediaManager } from '@/components/media/media-manager';
import type { MediaFile } from '@/types/api';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

const markdownHighlighting = HighlightStyle.define([
  { tag: t.heading1, fontSize: '1.3em', fontWeight: '700', color: '#111827' },
  { tag: t.heading2, fontSize: '1.2em', fontWeight: '600', color: '#111827' },
  { tag: t.heading3, fontSize: '1.1em', fontWeight: '600', color: '#1f2937' },
  { tag: t.heading4, fontWeight: '600', color: '#374151' },
  { tag: t.heading5, fontWeight: '600', color: '#374151' },
  { tag: t.heading6, fontWeight: '600', color: '#374151' },
  { tag: t.strong, fontWeight: '700', color: '#111827' },
  { tag: t.emphasis, fontStyle: 'italic', color: '#4b5563' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: '#6b7280' },
  { tag: t.link, color: '#2563eb', textDecoration: 'underline' },
  { tag: t.url, color: '#2563eb' },
  { tag: t.monospace, fontFamily: 'monospace', color: '#7c3aed', backgroundColor: '#f3f4f6' },
  { tag: t.quote, color: '#4b5563', fontStyle: 'italic' },
  { tag: t.list, color: '#6b7280' },
  { tag: t.contentSeparator, color: '#9ca3af' },
  { tag: t.meta, color: '#059669' },
  { tag: t.processingInstruction, color: '#dc2626' },
  { tag: t.comment, color: '#9ca3af', fontStyle: 'italic' },
]);

export function MarkdownEditor({ value, onChange, onSave }: MarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showMediaManager, setShowMediaManager] = useState(false);

  useEffect(() => {
    if (!editorRef.current) return;

    const startState = EditorState.create({
      doc: value,
      extensions: [
        markdown(),
        syntaxHighlighting(markdownHighlighting),
        lineNumbers(),
        history(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          {
            key: 'Mod-s',
            run: () => {
              onSave();
              return true;
            },
          },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newValue = update.state.doc.toString();
            onChange(newValue);
          }
        }),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': {
            fontSize: '14px',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
          },
          '.cm-content': {
            fontFamily: 'inherit',
            padding: '16px',
          },
          '.cm-line': {
            lineHeight: '1.75',
          },
          '&.cm-focused': {
            outline: 'none',
          },
          '.cm-header-1': {
            fontSize: '2em',
            fontWeight: '700',
            color: '#111827',
          },
          '.cm-header-2': {
            fontSize: '1.5em',
            fontWeight: '600',
            color: '#111827',
          },
          '.cm-header-3': {
            fontSize: '1.25em',
            fontWeight: '600',
            color: '#1f2937',
          },
          '.cm-strong': {
            fontWeight: '600',
            color: '#111827',
          },
          '.cm-em': {
            fontStyle: 'italic',
            color: '#374151',
          },
          '.cm-strikethrough': {
            textDecoration: 'line-through',
            color: '#6b7280',
          },
          '.cm-link': {
            color: '#2563eb',
            textDecoration: 'underline',
          },
          '.cm-url': {
            color: '#2563eb',
          },
          '.cm-monospace, .cm-code': {
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            backgroundColor: '#f3f4f6',
            padding: '2px 4px',
            borderRadius: '3px',
            color: '#1f2937',
            fontSize: '0.9em',
          },
          '.cm-quote': {
            color: '#4b5563',
            fontStyle: 'italic',
            borderLeft: '3px solid #e5e7eb',
            paddingLeft: '12px',
          },
          '.cm-list': {
            color: '#6b7280',
          },
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (viewRef.current) {
      const currentValue = viewRef.current.state.doc.toString();
      if (currentValue !== value) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentValue.length,
            insert: value,
          },
        });
      }
    }
  }, [value]);

  const insertMarkdown = (before: string, after: string = before) => {
    if (!viewRef.current) return;

    const view = viewRef.current;
    const { from, to } = view.state.selection.main;
    const selectedText = view.state.sliceDoc(from, to);

    view.dispatch({
      changes: {
        from,
        to,
        insert: `${before}${selectedText}${after}`,
      },
      selection: {
        anchor: from + before.length,
        head: from + before.length + selectedText.length,
      },
    });

    view.focus();
  };

  const toggleBold = () => insertMarkdown('**');
  const toggleItalic = () => insertMarkdown('*');
  const toggleStrikethrough = () => insertMarkdown('~~');
  const insertHeading = () => {
    if (!viewRef.current) return;

    const view = viewRef.current;
    const { from } = view.state.selection.main;
    const line = view.state.doc.lineAt(from);
    const lineText = line.text;

    const hashMatch = lineText.match(/^(#{1,6})\s/);
    const currentLevel = hashMatch ? hashMatch[1].length : 0;

    const nextLevel = currentLevel >= 3 ? 0 : currentLevel + 1;
    const newPrefix = nextLevel > 0 ? '#'.repeat(nextLevel) + ' ' : '';

    const textWithoutHeading = lineText.replace(/^#{1,6}\s/, '');

    view.dispatch({
      changes: {
        from: line.from,
        to: line.to,
        insert: newPrefix + textWithoutHeading,
      },
    });

    view.focus();
  };

  const insertLink = () => {
    if (!viewRef.current) return;
    const view = viewRef.current;
    const { from, to } = view.state.selection.main;
    const selectedText = view.state.sliceDoc(from, to);
    const linkText = selectedText || 'link text';

    view.dispatch({
      changes: {
        from,
        to,
        insert: `[${linkText}](url)`,
      },
      selection: {
        anchor: from + linkText.length + 3,
        head: from + linkText.length + 6,
      },
    });
    view.focus();
  };

  const insertQuote = () => {
    if (!viewRef.current) return;
    const view = viewRef.current;
    const { from } = view.state.selection.main;
    const line = view.state.doc.lineAt(from);

    view.dispatch({
      changes: {
        from: line.from,
        to: line.from,
        insert: '> ',
      },
    });
    view.focus();
  };

  const insertCode = () => insertMarkdown('`');

  const insertList = () => {
    if (!viewRef.current) return;
    const view = viewRef.current;
    const { from } = view.state.selection.main;
    const line = view.state.doc.lineAt(from);

    view.dispatch({
      changes: {
        from: line.from,
        to: line.from,
        insert: '- ',
      },
    });
    view.focus();
  };

  const insertOrderedList = () => {
    if (!viewRef.current) return;
    const view = viewRef.current;
    const { from } = view.state.selection.main;
    const line = view.state.doc.lineAt(from);

    view.dispatch({
      changes: {
        from: line.from,
        to: line.from,
        insert: '1. ',
      },
    });
    view.focus();
  };

  const insertImage = () => {
    setShowMediaManager(true);
  };

  const handleMediaSelect = (file: MediaFile) => {
    if (!viewRef.current) return;
    const view = viewRef.current;
    const { from, to } = view.state.selection.main;
    const selectedText = view.state.sliceDoc(from, to);
    const altText = selectedText || file.filename;

    // Use the file path relative to repo root
    view.dispatch({
      changes: {
        from,
        to,
        insert: `![${altText}](${file.url})`,
      },
    });
    view.focus();
    setShowMediaManager(false);
  };

  const insertTable = () => {
    if (!viewRef.current) return;
    const view = viewRef.current;
    const { from } = view.state.selection.main;
    const table = '\n| Header 1 | Header 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |\n';

    view.dispatch({
      changes: {
        from,
        to: from,
        insert: table,
      },
    });
    view.focus();
  };

  const insertHorizontalRule = () => {
    if (!viewRef.current) return;
    const view = viewRef.current;
    const { from } = view.state.selection.main;

    view.dispatch({
      changes: {
        from,
        to: from,
        insert: '\n---\n',
      },
    });
    view.focus();
  };

  const insertCallout = (type: 'info' | 'warning' | 'success' | 'important' | 'caution') => {
    if (!viewRef.current) return;
    const view = viewRef.current;
    const { from } = view.state.selection.main;

    const alertTypes = {
      info: 'NOTE',
      warning: 'WARNING',
      success: 'TIP',
      important: 'IMPORTANT',
      caution: 'CAUTION',
    };

    const calloutText = `\n> [!${alertTypes[type]}]\n> Your message here\n\n`;

    view.dispatch({
      changes: {
        from,
        to: from,
        insert: calloutText,
      },
    });
    view.focus();
  };

  return (
    <>
      {/* Toolbar - Sticky at top, z-20 */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="h-10 px-4 flex items-center gap-1">
          {/* Text Formatting */}
          <button
            onClick={toggleBold}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 transition-colors"
            title="Bold (Ctrl+B)"
          >
            <Bold size={18} />
          </button>

          <button
            onClick={toggleItalic}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 transition-colors"
            title="Italic (Ctrl+I)"
          >
            <Italic size={18} />
          </button>

          <button
            onClick={toggleStrikethrough}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 transition-colors"
            title="Strikethrough"
          >
            <Strikethrough size={18} />
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-gray-200 mx-2" />

          {/* Block Formatting */}
          <button
            onClick={insertHeading}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 transition-colors"
            title="Heading"
          >
            <Hash size={18} />
          </button>

          <button
            onClick={insertQuote}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 transition-colors"
            title="Quote"
          >
            <Quote size={18} />
          </button>

          <button
            onClick={insertCode}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 transition-colors"
            title="Inline Code"
          >
            <Code size={18} />
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-gray-200 mx-2" />

          {/* Lists */}
          <button
            onClick={insertList}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 transition-colors"
            title="Bullet List"
          >
            <List size={18} />
          </button>

          <button
            onClick={insertOrderedList}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 transition-colors"
            title="Numbered List"
          >
            <ListOrdered size={18} />
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-gray-200 mx-2" />

          {/* Insert Elements */}
          <button
            onClick={insertLink}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 transition-colors"
            title="Insert Link"
          >
            <Link2 size={18} />
          </button>

          <button
            onClick={insertImage}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 transition-colors"
            title="Insert Image"
          >
            <ImageIcon size={18} />
          </button>

          <button
            onClick={insertTable}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 transition-colors"
            title="Insert Table"
          >
            <Table size={18} />
          </button>

          <button
            onClick={insertHorizontalRule}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 transition-colors"
            title="Horizontal Rule"
          >
            <Minus size={18} />
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-gray-200 mx-2" />

          {/* Callouts/Alerts */}
          <button
            onClick={() => insertCallout('info')}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 transition-colors"
            title="Insert Info Callout"
          >
            <Info size={18} />
          </button>

          <button
            onClick={() => insertCallout('success')}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 transition-colors"
            title="Insert Tip Callout"
          >
            <Lightbulb size={18} />
          </button>

          <button
            onClick={() => insertCallout('important')}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 transition-colors"
            title="Insert Important Callout"
          >
            <AlertCircle size={18} />
          </button>

          <button
            onClick={() => insertCallout('warning')}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 transition-colors"
            title="Insert Warning Callout"
          >
            <AlertTriangle size={18} />
          </button>

          <button
            onClick={() => insertCallout('caution')}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 transition-colors"
            title="Insert Caution Callout"
          >
            <OctagonAlert size={18} />
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-gray-200 mx-2" />

          {/* Preview Toggle */}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`p-1.5 rounded transition-colors ${
              showPreview
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
            title="Toggle Preview"
          >
            {showPreview ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-gray-200 mx-2" />

          {/* Save Button */}
          <button
            onClick={onSave}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-md border border-transparent hover:border-gray-200 transition-all"
            title="Save (Ctrl+S)"
          >
            <Save size={14} />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-hidden">
        {showPreview ? (
          /* Split View: Editor | Preview */
          <div className="flex h-full animate-in fade-in duration-300">
            <div className="flex-1 border-r border-gray-200 overflow-y-auto">
              <div ref={editorRef} className="h-full" />
            </div>
            <div className="flex-1 overflow-y-auto bg-white">
              <div className="px-6 md:px-12 py-8 max-w-4xl mx-auto w-full">
                <MarkdownViewer content={value} />
              </div>
            </div>
          </div>
        ) : (
          /* Editor Only */
          <div className="h-full overflow-y-auto animate-in fade-in duration-300">
            <div ref={editorRef} className="h-full" />
          </div>
        )}
      </div>

      {/* Media Manager Modal */}
      <MediaManager
        isOpen={showMediaManager}
        onSelect={handleMediaSelect}
        onClose={() => setShowMediaManager(false)}
      />
    </>
  );
}

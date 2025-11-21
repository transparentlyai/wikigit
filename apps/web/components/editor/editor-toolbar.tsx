'use client';

/**
 * Editor Toolbar Component for WikiGit
 * Provides save, cancel, and preview actions
 */

import { Save, X, Eye } from 'lucide-react';

interface EditorToolbarProps {
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function EditorToolbar({ onSave, onCancel, isSaving }: EditorToolbarProps) {
  return (
    <div className="editor-toolbar">
      <button
        className="btn btn-primary"
        onClick={onSave}
        disabled={isSaving}
        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
      >
        {isSaving ? (
          <>
            <span className="loading-spinner" />
            Saving...
          </>
        ) : (
          <>
            <Save size={16} />
            Save
          </>
        )}
      </button>

      <button
        className="btn"
        onClick={onCancel}
        disabled={isSaving}
        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
      >
        <X size={16} />
        Cancel
      </button>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
        <button
          className="btn"
          title="Preview will be available in Phase 4"
          disabled
          style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.5 }}
        >
          <Eye size={16} />
          Preview
        </button>
      </div>
    </div>
  );
}

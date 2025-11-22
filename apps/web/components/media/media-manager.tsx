'use client';

import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import type { MediaFile } from '@/types/api';
import { Upload, Trash2, Image as ImageIcon, File, Video, Music, FileText } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface MediaManagerProps {
  onSelect?: (file: MediaFile) => void;
  onClose?: () => void;
  isOpen: boolean;
}

export function MediaManager({ onSelect, onClose, isOpen }: MediaManagerProps) {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [fileToDelete, setFileToDelete] = useState<MediaFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadMediaFiles();
    }
  }, [isOpen]);

  const loadMediaFiles = async () => {
    try {
      setIsLoading(true);
      const response = await api.getMediaFiles();
      setMediaFiles(response.files);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load media files');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const uploadedFile = await api.uploadMedia(file);
      toast.success(`Uploaded ${file.name}`);
      setMediaFiles([uploadedFile, ...mediaFiles]);

      // Auto-select the uploaded file
      setSelectedFile(uploadedFile);
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = (file: MediaFile, event: React.MouseEvent) => {
    event.stopPropagation();
    setFileToDelete(file);
  };

  const confirmDelete = async () => {
    if (!fileToDelete) return;

    try {
      await api.deleteMediaFile(fileToDelete.filename);
      toast.success(`Deleted ${fileToDelete.filename}`);
      setMediaFiles(mediaFiles.filter(f => f.filename !== fileToDelete.filename));

      if (selectedFile?.filename === fileToDelete.filename) {
        setSelectedFile(null);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete file');
    } finally {
      setFileToDelete(null);
    }
  };

  const handleInsert = () => {
    if (selectedFile && onSelect) {
      onSelect(selectedFile);
    }
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith('image/')) return <ImageIcon size={20} />;
    if (contentType.startsWith('video/')) return <Video size={20} />;
    if (contentType.startsWith('audio/')) return <Music size={20} />;
    if (contentType.startsWith('text/') || contentType === 'application/pdf') return <FileText size={20} />;
    return <File size={20} />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b border-gray-200">
          <DialogTitle>Media Manager</DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.txt"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={18} />
            {isUploading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">
              Loading media files...
            </div>
          ) : mediaFiles.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ImageIcon size={48} className="mx-auto mb-4 opacity-30" />
              <p>No media files yet</p>
              <p className="text-sm mt-2">Upload files to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {mediaFiles.map((file) => (
                <div
                  key={file.filename}
                  onClick={() => setSelectedFile(file)}
                  className={`relative group cursor-pointer rounded-lg border-2 overflow-hidden transition-all ${
                    selectedFile?.filename === file.filename
                      ? 'border-blue-500 shadow-lg'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Preview */}
                  <div className="aspect-square bg-gray-50 flex items-center justify-center p-4">
                    {file.content_type.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={file.url}
                        alt={file.filename}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="text-gray-400">
                        {getFileIcon(file.content_type)}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-2 bg-white border-t border-gray-200">
                    <p className="text-xs font-medium text-gray-900 truncate" title={file.filename}>
                      {file.filename}
                    </p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(file, e)}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    aria-label="Delete file"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-gray-200 flex justify-between items-center sm:justify-between">
          <div className="text-sm text-gray-600">
            {selectedFile ? (
              <span>
                Selected: <strong>{selectedFile.filename}</strong>
              </span>
            ) : (
              <span>Select a file to insert</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              onClick={handleInsert}
              disabled={!selectedFile}
            >
              Insert
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={!!fileToDelete}
        onOpenChange={(open) => !open && setFileToDelete(null)}
        title="Delete File"
        description={`Are you sure you want to delete ${fileToDelete?.filename || 'this file'}?`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </Dialog>
  );
}

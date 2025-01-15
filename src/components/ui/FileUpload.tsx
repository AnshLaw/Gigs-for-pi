import React, { useRef, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { formatFileSize } from '../../lib/utils';

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  accept?: string;
  maxSize?: number; // in bytes
}

export function FileUpload({ 
  onFileSelect, 
  accept = ".pdf,.doc,.docx,.txt,image/*", 
  maxSize = 10 * 1024 * 1024 // 10MB default
}: FileUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);

    if (file) {
      if (file.size > maxSize) {
        setError(`File size must be less than ${formatFileSize(maxSize)}`);
        onFileSelect(null);
        return;
      }

      onFileSelect(file);
      
      // Clear the input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept={accept}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <Paperclip className="w-4 h-4" />
          Attach Document
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
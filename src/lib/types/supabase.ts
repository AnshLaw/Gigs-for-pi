import { FileOptions } from '@supabase/storage-js';

export interface UploadProgressEvent {
  loaded: number;
  total: number;
}

export interface CustomFileOptions extends FileOptions {
  onUploadProgress?: (progress: UploadProgressEvent) => void;
}
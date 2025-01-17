import type { SupabaseClient } from '@supabase/supabase-js';

export interface UploadProgressEvent {
  loaded: number;
  total: number;
}

export interface FileOptions {
  cacheControl?: string;
  contentType?: string;
  duplex?: string;
  upsert?: boolean;
}

export interface CustomFileOptions extends FileOptions {
  onUploadProgress?: (progressEvent: UploadProgressEvent) => void;
}

export type RealtimeChannel = ReturnType<typeof SupabaseClient.prototype.channel>;

export interface StorageUploadResponse {
  error: Error | null;
  data: {
    path: string;
  } | null;
}

export interface Attachment {
  id: string;
  file_name: string;
  file_type: string;
  file_path: string;
  file_size: number;
}
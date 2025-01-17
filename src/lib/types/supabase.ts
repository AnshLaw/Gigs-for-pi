import { supabase } from "../supabase";

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
    onUploadProgress?: (progress: UploadProgressEvent) => void;
  }
  
  export type RealtimeChannel = ReturnType<typeof supabase.channel>;
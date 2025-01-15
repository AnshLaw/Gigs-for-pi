export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string
          created_at: string
          title: string
          description: string
          payment_amount: number
          creator_id: string
          executor_id: string | null
          status: 'open' | 'in_progress' | 'completed' | 'disputed'
        }
        Insert: {
          id?: string
          created_at?: string
          title: string
          description: string
          payment_amount: number
          creator_id: string
          executor_id?: string | null
          status?: 'open' | 'in_progress' | 'completed' | 'disputed'
        }
        Update: {
          id?: string
          created_at?: string
          title?: string
          description?: string
          payment_amount?: number
          creator_id?: string
          executor_id?: string | null
          status?: 'open' | 'in_progress' | 'completed' | 'disputed'
        }
      }
      bids: {
        Row: {
          id: string
          created_at: string
          task_id: string
          bidder_id: string
          amount: number
          status: 'pending' | 'accepted' | 'rejected'
        }
        Insert: {
          id?: string
          created_at?: string
          task_id: string
          bidder_id: string
          amount: number
          status?: 'pending' | 'accepted' | 'rejected'
        }
        Update: {
          id?: string
          created_at?: string
          task_id?: string
          bidder_id?: string
          amount?: number
          status?: 'pending' | 'accepted' | 'rejected'
        }
      }
      messages: {
        Row: {
          id: string
          created_at: string
          task_id: string
          sender_id: string
          content: string
        }
        Insert: {
          id?: string
          created_at?: string
          task_id: string
          sender_id: string
          content: string
        }
        Update: {
          id?: string
          created_at?: string
          task_id?: string
          sender_id?: string
          content?: string
        }
      }
      profiles: {
        Row: {
          id: string
          created_at: string
          pi_user_id: string
          username: string
          rating: number
          completed_tasks: number
        }
        Insert: {
          id?: string
          created_at?: string
          pi_user_id: string
          username: string
          rating?: number
          completed_tasks?: number
        }
        Update: {
          id?: string
          created_at?: string
          pi_user_id?: string
          username?: string
          rating?: number
          completed_tasks?: number
        }
      }
    }
  }
}
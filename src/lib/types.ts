// Common types used across the application
export interface Profile {
  id: string;
  created_at: string;
  pi_user_id: string;
  username: string;
  rating: number;
  completed_tasks: number;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface Task {
  id: string;
  created_at: string;
  title: string;
  description: string;
  payment_amount: number;
  creator_id: string;
  executor_id: string | null;
  status: 'open' | 'in_progress' | 'completed' | 'disputed';
  attachments?: TaskAttachment[];
  creator?: {
    username: string;
    rating: number;
  };
}

export interface Bid {
  id: string;
  created_at: string;
  task_id: string;
  bidder_id: string;
  amount: number;
  status: 'pending' | 'accepted' | 'rejected';
  bidder?: {
    username: string;
    rating: number;
  };
}

export interface Message {
  id: string;
  content: string;
  created_at: string;
  task_id: string;
  sender: {
    username: string;
  };
  sender_id: string;
  attachments?: {
    id: string;
    file_name: string;
    file_type: string;
    file_path: string;
    file_size: number;
  }[];
}
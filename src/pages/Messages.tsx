import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Send, Paperclip, X, Download, Menu, MessageCircle } from 'lucide-react';
import type { Attachment, CustomFileOptions, RealtimeChannel } from '../lib/types/supabase';

interface Message {
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

interface Task {
  id: string;
  title: string;
  creator_id: string;
  executor_id: string;
}

export function Messages() {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<{ id: string } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageContent, setMessageContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showSidebar, setShowSidebar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchTasks();
    }
  }, [user]);

  useEffect(() => {
    if (selectedTask) {
      fetchMessages();
      setupRealtimeSubscription();
    }

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [selectedTask]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchUserProfile = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('pi_user_id', user.id)
      .single();

    setUserProfile(profile);
  };

  const fetchTasks = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('pi_user_id', user.id)
      .single();

    if (profile) {
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .or(`creator_id.eq.${profile.id},executor_id.eq.${profile.id}`)
        .eq('status', 'in_progress');

      setTasks(tasksData || []);
      
      if (tasksData?.length && !selectedTask) {
        setSelectedTask(tasksData[0].id);
      }
    }
  };

  const fetchMessages = async () => {
    const { data: messagesData } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey (
          username
        ),
        attachments (
          id,
          file_name,
          file_type,
          file_path,
          file_size
        )
      `)
      .eq('task_id', selectedTask)
      .order('created_at', { ascending: true });

    setMessages(messagesData || []);
  };

  const setupRealtimeSubscription = () => {
    // Unsubscribe from previous channel if it exists
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }

    // Create a new channel for the selected task
    const channel = supabase.channel(`messages:${selectedTask}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `task_id=eq.${selectedTask}`,
        },
        async (payload) => {
          // Only fetch and add the message if it wasn't sent by the current user
          if (payload.new.sender_id !== userProfile?.id) {
            const { data: newMessage } = await supabase
              .from('messages')
              .select(`
                *,
                sender:profiles!messages_sender_id_fkey (
                  username
                ),
                attachments (
                  id,
                  file_name,
                  file_type,
                  file_path,
                  file_size
                )
              `)
              .eq('id', payload.new.id)
              .single();

            if (newMessage) {
              setMessages(current => [...current, newMessage]);
              scrollToBottom();
            }
          }
        }
      )
      .subscribe();

    // Store the channel reference
    channelRef.current = channel;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('attachments')
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading file:', err);
      setError('Failed to download file');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile || !selectedTask || (!messageContent.trim() && !selectedFile)) return;

    setSendingMessage(true);
    setError(null);
    setUploadProgress(0);

    try {
      let filePath: string | undefined;
      
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop() || '';
        const fileName = `${Math.random()}.${fileExt}`;

        const options: CustomFileOptions = {
          onUploadProgress: (progress) => {
            setUploadProgress((progress.loaded / progress.total) * 100);
          }
        };

        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(fileName, selectedFile, options);

        if (uploadError) throw uploadError;
        filePath = fileName;
      }

      // Insert the message
      const { data: newMessage, error: messageError } = await supabase
        .from('messages')
        .insert({
          task_id: selectedTask,
          sender_id: userProfile.id,
          content: messageContent.trim() || ' ',
        })
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey (
            username
          )
        `)
        .single();

      if (messageError) throw messageError;

      // If there's a file and it was uploaded successfully
      if (filePath && newMessage && selectedFile) {
        const { error: attachmentError } = await supabase
          .from('attachments')
          .insert({
            message_id: newMessage.id,
            file_path: filePath,
            file_name: selectedFile.name,
            file_type: selectedFile.type,
            file_size: selectedFile.size,
          });

        if (attachmentError) throw attachmentError;

        // Fetch the complete message with attachments
        const { data: messageWithAttachments } = await supabase
          .from('messages')
          .select(`
            *,
            sender:profiles!messages_sender_id_fkey (
              username
            ),
            attachments (
              id,
              file_name,
              file_type,
              file_path,
              file_size
            )
          `)
          .eq('id', newMessage.id)
          .single();

        if (messageWithAttachments) {
          setMessages(current => [...current, messageWithAttachments]);
        }
      } else if (newMessage) {
        setMessages(current => [...current, { ...newMessage, attachments: [] }]);
      }

      setMessageContent('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      scrollToBottom();
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSendingMessage(false);
      setUploadProgress(0);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Please sign in to view messages.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex gap-4 h-[calc(100vh-12rem)]">
        {/* Mobile menu button */}
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="fixed top-20 left-4 p-2 bg-white rounded-full shadow-lg md:hidden z-50"
        >
          {showSidebar ? (
            <X className="h-6 w-6 text-gray-600" />
          ) : (
            <Menu className="h-6 w-6 text-gray-600" />
          )}
        </button>

        {/* Tasks Sidebar */}
        <div className={`
          fixed md:relative inset-y-0 left-0 z-40 w-64 bg-white shadow-md 
          transform transition-transform duration-300 ease-in-out
          ${showSidebar ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}>
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Active Tasks</h2>
          </div>
          <div className="overflow-y-auto h-full">
            {tasks.map((task) => (
              <button
                key={task.id}
                onClick={() => {
                  setSelectedTask(task.id);
                  setShowSidebar(false);
                }}
                className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                  selectedTask === task.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
                }`}
              >
                <h3 className="font-medium text-gray-900 truncate">{task.title}</h3>
              </button>
            ))}
            {tasks.length === 0 && (
              <div className="p-4 text-sm text-gray-500 text-center">
                No active tasks found
              </div>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 bg-white shadow-md rounded-lg overflow-hidden ml-0 md:ml-0">
          {selectedTask ? (
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.sender_id === userProfile?.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.sender_id === userProfile?.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="text-sm font-medium mb-1">
                        {message.sender.username}
                      </div>
                      {message.content.trim() && <div>{message.content}</div>}
                      {message.attachments?.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="mt-2 p-2 rounded bg-white/10 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <Paperclip className="h-4 w-4" />
                            <span className="flex-1 truncate">{attachment.file_name}</span>
                            <span className="text-xs opacity-75">
                              {formatFileSize(attachment.file_size)}
                            </span>
                            <button
                              onClick={() => handleDownload(attachment)}
                              className="p-1 hover:bg-white/20 rounded"
                              title="Download file"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="text-xs opacity-75 mt-1">
                        {new Date(message.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t">
                {error && (
                  <div className="mb-4 text-sm text-red-600 bg-red-50 rounded p-2">
                    {error}
                  </div>
                )}
                
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  
                  <div className="relative">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 10 * 1024 * 1024) {
                            setError('File size must be less than 10MB');
                            return;
                          }
                          setSelectedFile(file);
                        }
                      }}
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.txt"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-gray-500 hover:text-gray-700"
                    >
                      <Paperclip className="h-5 w-5" />
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={sendingMessage || (!messageContent.trim() && !selectedFile)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>

                {selectedFile && (
                  <div className="mt-2 p-2 bg-gray-50 rounded-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Paperclip className="h-4 w-4" />
                        <span className="truncate">{selectedFile.name}</span>
                        <span>({formatFileSize(selectedFile.size)})</span>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedFile(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {uploadProgress > 0 && uploadProgress < 100 && (
                      <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-gray-500">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a task to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
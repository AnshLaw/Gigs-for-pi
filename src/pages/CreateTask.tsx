import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { FileUpload } from '../components/ui/FileUpload';
import { AlertCircle, X } from 'lucide-react';

export function CreateTask() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    payment_amount: '',
  });

  const uploadFile = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(fileName, file, {
        onUploadProgress: (progress) => {
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: (progress.loaded / progress.total) * 100
          }));
        },
      });

    if (uploadError) throw uploadError;

    return fileName;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);
    setUploadProgress({});

    try {
      // First, get or create profile
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('pi_user_id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      let profileId;

      if (!existingProfile) {
        // Create profile if it doesn't exist
        const { data: newProfile, error: createProfileError } = await supabase
          .from('profiles')
          .insert({
            pi_user_id: user.id,
            username: user.email?.split('@')[0] || 'user',
          })
          .select('id')
          .single();

        if (createProfileError) throw createProfileError;
        if (!newProfile) throw new Error('Failed to create profile');
        
        profileId = newProfile.id;
      } else {
        profileId = existingProfile.id;
      }

      // Create the task
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          title: formData.title,
          description: formData.description,
          payment_amount: parseFloat(formData.payment_amount),
          creator_id: profileId,
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Upload files and create attachments
      if (selectedFiles.length > 0) {
        const attachmentPromises = selectedFiles.map(async (file) => {
          const filePath = await uploadFile(file);
          return {
            task_id: task.id,
            file_path: filePath,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
          };
        });

        const attachments = await Promise.all(attachmentPromises);

        const { error: attachmentsError } = await supabase
          .from('task_attachments')
          .insert(attachments);

        if (attachmentsError) throw attachmentsError;
      }

      navigate('/tasks');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setUploadProgress({});
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Please sign in to create a gig.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create a New Gig</h1>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-md">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-600 p-3 rounded-md text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Title
          </label>
          <input
            type="text"
            id="title"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            required
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="payment" className="block text-sm font-medium text-gray-700">
            Payment Amount (π)
          </label>
          <input
            type="number"
            id="payment"
            required
            min="0"
            step="0.01"
            value={formData.payment_amount}
            onChange={(e) => setFormData({ ...formData, payment_amount: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Attachments
          </label>
          <FileUpload
            onFileSelect={(file) => file && setSelectedFiles(prev => [...prev, file])}
            accept=".pdf,.doc,.docx,.txt,image/*"
            maxSize={10 * 1024 * 1024} // 10MB
          />

          {selectedFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="truncate max-w-xs">{file.name}</span>
                    <span className="text-gray-400">
                      ({Math.round(file.size / 1024)} KB)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {uploadProgress[file.name] > 0 && uploadProgress[file.name] < 100 && (
                      <div className="w-20 h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 transition-all duration-300"
                          style={{ width: `${uploadProgress[file.name]}%` }}
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Gig'}
        </button>
      </form>
    </div>
  );
}
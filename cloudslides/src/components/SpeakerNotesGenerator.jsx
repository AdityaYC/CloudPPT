import React, { useState } from 'react';
import { Mic, Upload, Loader2, Check, AlertCircle, FileText } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5001/api';

function SpeakerNotesGenerator({ token, onAuthError }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [style, setStyle] = useState('professional');
  const [detail, setDetail] = useState('medium');
  const [audience, setAudience] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [notesPreview, setNotesPreview] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = ['.pdf', '.pptx', '.ppt', '.docx', '.doc', '.txt'];
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (allowedTypes.includes(ext)) {
        setSelectedFile(file);
        setError(null);
      } else {
        setError('Please upload a PDF, PPTX, DOCX, or TXT file');
        setSelectedFile(null);
      }
    }
  };

  const handleGenerate = async () => {
    if (!selectedFile) {
      setError('Please upload a document first');
      return;
    }

    const authToken = token || localStorage.getItem('token');
    if (!authToken) {
      if (onAuthError) onAuthError();
      setError('Authentication required. Please refresh the page.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccess(null);
    setNotesPreview(null);

    try {
      const formData = new FormData();
      formData.append('document', selectedFile);
      formData.append('style', style);
      formData.append('detail', detail);
      if (audience.trim()) {
        formData.append('audience', audience.trim());
      }

      const response = await fetch(`${API_BASE_URL}/speaker-notes/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || data.message || 'Failed to generate speaker notes';
        throw new Error(errorMsg);
      }

      if (data.success && data.speakerNotes) {
        setSuccess('Speaker notes generated successfully!');
        setNotesPreview(data.speakerNotes.notes);

        // Auto-download the file
        if (data.speakerNotes.fileUrl) {
          try {
            const downloadUrl = `http://localhost:5001${data.speakerNotes.fileUrl}`;
            const downloadResponse = await fetch(downloadUrl, {
              headers: {
                'Authorization': `Bearer ${authToken}`,
              },
            });

            if (downloadResponse.ok) {
              const blob = await downloadResponse.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = data.speakerNotes.filename || 'speaker-notes.txt';
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            }
          } catch (downloadErr) {
            console.error('Download error:', downloadErr);
          }
        }
      }
    } catch (err) {
      console.error('Generate error:', err);
      setError(err.message || 'Failed to generate speaker notes. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 p-8 md:p-10">
        <div className="flex items-center gap-3 mb-6">
          <Mic className="w-6 h-6 text-primary-600" />
          <h2 className="text-2xl font-bold">Generate Speaker Notes</h2>
        </div>

        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Document (PDF, PPTX, DOCX, TXT)
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-primary-400 transition-colors">
            <input
              type="file"
              id="document-upload"
              accept=".pdf,.pptx,.ppt,.docx,.doc,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="document-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">
                {selectedFile ? selectedFile.name : 'Click to upload or drag and drop'}
              </p>
              <p className="text-sm text-gray-500">Max file size: 20MB</p>
            </label>
          </div>
        </div>

        {/* Options */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Style
            </label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none"
            >
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="academic">Academic</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Detail Level
            </label>
            <select
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none"
            >
              <option value="brief">Brief</option>
              <option value="medium">Medium</option>
              <option value="comprehensive">Comprehensive</option>
            </select>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Audience (Optional)
          </label>
          <input
            type="text"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g., Business executives, Students, General public"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none"
          />
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-primary-50 border border-primary-200 rounded-xl flex items-start gap-3">
            <Check className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-primary-800">{success}</p>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={!selectedFile || isGenerating}
          className="w-full px-8 py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white text-lg font-semibold rounded-full hover:shadow-glow-lg hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating Notes...
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              Generate Speaker Notes
            </>
          )}
        </button>
      </div>

      {/* Notes Preview */}
      {notesPreview && (
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 p-8 md:p-10">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-primary-600" />
            <h3 className="text-xl font-bold">Generated Notes Preview</h3>
          </div>
          <div className="prose max-w-none">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-6 rounded-xl border border-gray-200 max-h-96 overflow-y-auto">
              {notesPreview}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default SpeakerNotesGenerator;


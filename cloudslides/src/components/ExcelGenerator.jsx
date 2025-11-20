import React, { useState } from 'react';
import { FileSpreadsheet, Loader2, Check, AlertCircle, Upload } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5001/api';

function ExcelGenerator({ token, onAuthError }) {
  const [prompt, setPrompt] = useState('');
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('prompt'); // 'prompt', 'pdf', or 'csv'
  const [rows, setRows] = useState(20);
  const [includeFormulas, setIncludeFormulas] = useState(true);
  const [includeCharts, setIncludeCharts] = useState(false);
  const [organizeData, setOrganizeData] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [result, setResult] = useState(null);

  const handleGenerateFromPrompt = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt describing the data you need');
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
    setResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/excel/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          rows: parseInt(rows),
          includeFormulas,
          includeCharts,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || data.message || 'Failed to generate Excel file';
        throw new Error(errorMsg);
      }

      if (data.success && data.excel) {
        setSuccess('Excel file generated successfully!');
        setResult(data.excel);

        // Download the file
        if (data.excel.fileUrl) {
          downloadFile(data.excel.fileUrl, data.excel.filename, authToken);
        }

        setTimeout(() => {
          setPrompt('');
          setSuccess(null);
        }, 3000);
      }
    } catch (err) {
      console.error('Generate error:', err);
      setError(err.message || 'Failed to generate Excel file. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateFromFile = async () => {
    if (!file) {
      setError('Please select a file');
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
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('organizeData', organizeData.toString());
      formData.append('extractTables', 'true');

      const response = await fetch(`${API_BASE_URL}/excel/generate-from-file`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || data.message || `Failed to generate Excel from ${mode.toUpperCase()}`;
        throw new Error(errorMsg);
      }

      if (data.success && data.excel) {
        setSuccess(`Excel file generated from ${mode.toUpperCase()} successfully!`);
        setResult(data.excel);

        // Download the file
        if (data.excel.fileUrl) {
          downloadFile(data.excel.fileUrl, data.excel.filename, authToken);
        }
      }
    } catch (err) {
      console.error('Generate error:', err);
      setError(err.message || `Failed to generate Excel from ${mode.toUpperCase()}. Please try again.`);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadFile = async (fileUrl, filename, authToken) => {
    try {
      const downloadUrl = `http://localhost:5001${fileUrl}`;
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
        a.download = filename || 'excel.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (downloadErr) {
      console.error('Download error:', downloadErr);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 p-8 md:p-10">
        <div className="flex items-center gap-3 mb-6">
          <FileSpreadsheet className="w-6 h-6 text-primary-600" />
          <h2 className="text-2xl font-bold">Excel Generator</h2>
        </div>

        {/* Mode Selector */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => {
              setMode('prompt');
              setError(null);
              setResult(null);
            }}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all text-sm ${mode === 'prompt'
              ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg'
              : 'bg-accent-100 text-gray-600 hover:bg-accent-200'
              }`}
          >
            Text Prompt
          </button>
          <button
            onClick={() => {
              setMode('pdf');
              setError(null);
              setResult(null);
              setFile(null);
            }}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all text-sm ${mode === 'pdf'
              ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg'
              : 'bg-accent-100 text-gray-600 hover:bg-accent-200'
              }`}
          >
            From PDF
          </button>
          <button
            onClick={() => {
              setMode('csv');
              setError(null);
              setResult(null);
              setFile(null);
            }}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all text-sm ${mode === 'csv'
              ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg'
              : 'bg-accent-100 text-gray-600 hover:bg-accent-200'
              }`}
          >
            From CSV
          </button>
        </div>

        {/* Prompt Mode */}
        {mode === 'prompt' && (
          <>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-40 px-6 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all resize-none outline-none placeholder:text-gray-400"
              placeholder="Describe the data you need... 
Example: Create a sales dataset with 50 customers including customer name, product purchased, quantity, unit price, total revenue, purchase date, and region."
            />

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Rows: {rows}
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={rows}
                  onChange={(e) => setRows(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeFormulas}
                    onChange={(e) => setIncludeFormulas(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Include Formulas</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCharts}
                    onChange={(e) => setIncludeCharts(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Include Charts</span>
                </label>
              </div>
            </div>

            <button
              onClick={handleGenerateFromPrompt}
              disabled={!prompt.trim() || isGenerating}
              className="mt-6 w-full px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-lg font-semibold rounded-full hover:shadow-glow-lg hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating Excel...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-5 h-5" />
                  Generate Excel from Prompt
                </>
              )}
            </button>
          </>
        )}

        {/* File Upload Mode (PDF or CSV) */}
        {(mode === 'pdf' || mode === 'csv') && (
          <>
            <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-primary-400 transition-colors">
              <input
                type="file"
                accept={mode === 'pdf' ? '.pdf' : '.csv'}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    setFile(file);
                    setError(null);
                  }
                }}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-4"
              >
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-primary-600" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-700">
                    {file ? file.name : `Upload ${mode.toUpperCase()} File`}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {mode === 'csv'
                      ? 'AI will clean and organize your CSV data'
                      : 'AI will extract and organize data into Excel'}
                  </p>
                </div>
              </label>
            </div>

            {mode === 'csv' && (
              <div className="mt-4 flex items-center gap-3 justify-center">
                <input
                  type="checkbox"
                  id="organize-data"
                  checked={organizeData}
                  onChange={(e) => setOrganizeData(e.target.checked)}
                  className="w-5 h-5 text-primary-600 rounded"
                />
                <label htmlFor="organize-data" className="text-sm text-gray-700 cursor-pointer">
                  Use AI to enhance and organize data (recommended)
                </label>
              </div>
            )}

            <button
              onClick={handleGenerateFromFile}
              disabled={!file || isGenerating}
              className="mt-6 w-full px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-lg font-semibold rounded-full hover:shadow-glow-lg hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing {mode.toUpperCase()}...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-5 h-5" />
                  Generate Excel from {mode.toUpperCase()}
                </>
              )}
            </button>
          </>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mt-4 p-4 bg-primary-50 border border-primary-200 rounded-xl">
            <p className="text-primary-800 font-semibold mb-2">✅ {success}</p>
            {result && result.metadata && (
              <div className="mt-2 text-sm text-primary-700">
                {result.metadata.title && <p>Title: {result.metadata.title}</p>}
                {result.metadata.description && <p>Description: {result.metadata.description}</p>}
                {result.metadata.rowCount && <p>Rows: {result.metadata.rowCount}</p>}
              </div>
            )}
            {result && result.fileUrl && (
              <button
                onClick={() => downloadFile(result.fileUrl, result.filename, token || localStorage.getItem('token'))}
                className="mt-3 inline-block px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Download Again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ExcelGenerator;

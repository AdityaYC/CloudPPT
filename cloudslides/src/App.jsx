import React, { useState, useEffect } from 'react';
import { Sparkles, Lightbulb, Zap, Rocket, ArrowRight, Menu, X, Check, Loader2, AlertCircle, Upload, File, FileSpreadsheet, Mic } from 'lucide-react';
import ExcelGenerator from './components/ExcelGenerator';
import SpeakerNotesGenerator from './components/SpeakerNotesGenerator';

const API_BASE_URL = 'http://localhost:5001/api';

function App() {
  const [topic, setTopic] = useState('');
  const [selectedMode, setSelectedMode] = useState('professional');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [selectedTemplate, setSelectedTemplate] = useState('none');
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [activeFeature, setActiveFeature] = useState('presentations'); // presentations, excel, speaker-notes

  const presentationModes = [
    { id: 'investor', name: 'Investor Pitch', emoji: '💼', description: 'Impress investors' },
    { id: 'professional', name: 'Professional', emoji: '📊', description: 'Business ready' },
    { id: 'educational', name: 'Educational', emoji: '📚', description: 'Teaching focused' },
    { id: 'fun', name: 'Fun', emoji: '🎨', description: 'Bold & artistic' },
  ];

  // Auto-register/login on mount
  useEffect(() => {
    const ensureAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        // Silently try to register (don't show errors on page load)
        try {
          await autoRegister();
        } catch (err) {
          // Silently fail on initial load - will show error when user tries to generate
          console.log('Initial auth check:', err);
        }
      } else {
        setToken(storedToken);
      }
    };
    ensureAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Load available templates
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const authToken = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/presentations/templates`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      const data = await response.json();
      if (data.templates && Array.isArray(data.templates)) {
        setAvailableTemplates(data.templates);
        console.log('✅ Loaded templates:', data.templates.length);
      } else {
        console.warn('No templates found in response');
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const handleTemplateUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const authToken = localStorage.getItem('token');
    if (!authToken) {
      setError('Please refresh the page to authenticate');
      return;
    }

    const formData = new FormData();
    formData.append('template', file);
    formData.append('name', file.name.replace('.pptx', '').replace('.ppt', ''));
    formData.append('isPublic', 'false');

    try {
      const response = await fetch(`${API_BASE_URL}/presentations/upload-template`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Template uploaded successfully! It will appear in the dropdown below.');
        loadTemplates(); // Refresh list
        // Auto-select the newly uploaded template
        if (data.template && data.template.id) {
          setSelectedTemplate(data.template.id);
        }
        // Clear file input
        e.target.value = '';
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to upload template');
      }
    } catch (err) {
      console.error('Template upload error:', err);
      setError('Failed to upload template. Please try again.');
    }
  };

  const autoRegister = async () => {
    // Get or create a persistent user ID
    let userId = localStorage.getItem('cloudslides_user_id');
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('cloudslides_user_id', userId);
    }

    const email = `${userId}@cloudslides.local`;
    const password = 'cloudslides_temp_password_123';
    const name = 'CloudSlides User';

    try {
      // Try to register first
      const registerResponse = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      });

      const registerData = await registerResponse.json();

      if (registerData.success && registerData.token) {
        setToken(registerData.token);
        localStorage.setItem('token', registerData.token);
        return true;
      }

      // If email already exists, try to login
      if (registerResponse.status === 400 && registerData.error?.includes('already registered')) {
        const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        const loginData = await loginResponse.json();
        if (loginData.success && loginData.token) {
          setToken(loginData.token);
          localStorage.setItem('token', loginData.token);
          return true;
        }
      }

      throw new Error(registerData.error || 'Registration failed');
    } catch (err) {
      console.error('Authentication error:', err);

      // Check if backend is reachable
      const errorMessage = err.message || err.toString();
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError') || errorMessage.includes('fetch')) {
        throw new Error('Cannot connect to server. Make sure the backend is running on port 5001.');
      } else {
        throw err; // Re-throw the original error with its message
      }
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic for your presentation');
      return;
    }

    // Ensure we have a token
    let authToken = token || localStorage.getItem('token');
    if (!authToken) {
      try {
        await autoRegister();
        authToken = localStorage.getItem('token');
        if (!authToken) {
          setError('Authentication failed. Please check if the backend server is running on port 5001.');
          return;
        }
      } catch (err) {
        setError(err.message || 'Authentication failed. Please check if the backend server is running on port 5001.');
        return;
      }
    }

    setIsGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      // Use JSON request - template is selected from dropdown (saved templates)
      const response = await fetch(`${API_BASE_URL}/presentations/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          topic: topic.trim(),
          mode: selectedMode,
          templateId: selectedTemplate !== 'none' ? selectedTemplate : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Show detailed error message if available
        const errorMsg = data.error || data.message || 'Failed to generate presentation';
        throw new Error(errorMsg);
      }

      if (data.success && data.presentation) {
        setSuccess('Presentation generated successfully!');

        // Download the file with authentication
        if (data.presentation.fileUrl) {
          try {
            const downloadUrl = `http://localhost:5001${data.presentation.fileUrl}`;
            const response = await fetch(downloadUrl, {
              headers: {
                'Authorization': `Bearer ${authToken}`,
              },
            });

            if (response.ok) {
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = data.presentation.fileUrl.split('/').pop() || 'presentation.pptx';
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            } else {
              console.error('Download failed:', response.statusText);
            }
          } catch (downloadErr) {
            console.error('Download error:', downloadErr);
            // Don't show error to user, file generation was successful
          }
        }

        // Clear the form after a delay
        setTimeout(() => {
          setTopic('');
          setSuccess(null);
        }, 3000);
      }
    } catch (err) {
      console.error('Generate error:', err);
      setError(err.message || 'Failed to generate presentation. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden shadow-lg border-2 border-primary-600">
                <img src="/logo.png" alt="CloudSlides Logo" className="w-full h-full object-cover" />
              </div>
              <span className="text-xl font-bold text-primary-700">
                CloudSlides
              </span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">Features</a>
              <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">How it Works</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">Pricing</a>
              <button className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-accent-600 text-white rounded-full font-semibold hover:shadow-glow transition-all duration-300 hover:scale-105">
                Get Started
              </button>
            </nav>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-4 space-y-3">
              <a href="#features" className="block py-2 text-gray-600 hover:text-gray-900 font-medium">Features</a>
              <a href="#how-it-works" className="block py-2 text-gray-600 hover:text-gray-900 font-medium">How it Works</a>
              <a href="#pricing" className="block py-2 text-gray-600 hover:text-gray-900 font-medium">Pricing</a>
              <button className="w-full px-6 py-2.5 bg-gradient-to-r from-primary-600 to-accent-600 text-white rounded-full font-semibold">
                Get Started
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Animated Background Blobs */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-100 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob"></div>
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-accent-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-primary-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-4000"></div>
        </div>

        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 rounded-full mb-8 border border-primary-100">
            <Sparkles className="w-4 h-4 text-primary-600" />
            <span className="text-sm font-semibold text-primary-700">Powered by Claude AI</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6">
            If you can type it,{' '}
            <span className="text-primary-600">
              CloudSlides can present it.
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
            Transform your ideas into stunning slides with AI.
            <br className="hidden sm:block" />
            No design experience needed.
          </p>

          {/* CTA Button */}
          <a
            href="#generator"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary-600 to-accent-600 text-white text-lg font-semibold rounded-full hover:shadow-glow-lg transition-all duration-300 hover:scale-105"
          >
            Start Creating Free
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-accent-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-gray-600">Three simple steps to amazing presentations</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="group relative">
              <div className="relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-2 border border-gray-100">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-accent-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg">
                    <Lightbulb className="w-8 h-8 text-white" />
                  </div>
                  <div className="mb-4">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold text-sm">1</span>
                  </div>
                  <h3 className="text-xl font-bold mb-3">Describe Your Idea</h3>
                  <p className="text-gray-600 leading-relaxed">Tell us what you want to present and who your audience is</p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="group relative">
              <div className="relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-2 border border-gray-100">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-accent-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                  <div className="mb-4">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold text-sm">2</span>
                  </div>
                  <h3 className="text-xl font-bold mb-3">AI Generates Slides</h3>
                  <p className="text-gray-600 leading-relaxed">Claude AI creates professional slides instantly tailored to your needs</p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="group relative">
              <div className="relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-2 border border-gray-100">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-accent-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg">
                    <Rocket className="w-8 h-8 text-white" />
                  </div>
                  <div className="mb-4">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold text-sm">3</span>
                  </div>
                  <h3 className="text-xl font-bold mb-3">Present & Share</h3>
                  <p className="text-gray-600 leading-relaxed">Export as PDF, PPTX, or present directly from the browser</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Selector */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Choose Your Tool</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Presentations */}
            <button
              onClick={() => setActiveFeature('presentations')}
              className={`p-6 rounded-2xl border-2 transition-all ${activeFeature === 'presentations'
                ? 'border-primary-500 bg-gradient-to-br from-primary-50 to-accent-50 shadow-glow'
                : 'border-gray-200 bg-white hover:border-primary-300'
                }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${activeFeature === 'presentations'
                  ? 'bg-gradient-to-br from-primary-500 to-accent-500'
                  : 'bg-gray-100'
                  }`}>
                  <Sparkles className={`w-6 h-6 ${activeFeature === 'presentations' ? 'text-white' : 'text-gray-600'
                    }`} />
                </div>
                <h3 className="text-lg font-bold">Presentations</h3>
              </div>
              <p className="text-sm text-gray-600">AI-powered slide generation</p>
            </button>

            {/* Excel */}
            <button
              onClick={() => setActiveFeature('excel')}
              className={`p-6 rounded-2xl border-2 transition-all ${activeFeature === 'excel'
                ? 'border-primary-500 bg-gradient-to-br from-primary-50 to-accent-50 shadow-glow'
                : 'border-gray-200 bg-white hover:border-primary-300'
                }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${activeFeature === 'excel'
                  ? 'bg-gradient-to-br from-primary-500 to-accent-500'
                  : 'bg-gray-100'
                  }`}>
                  <FileSpreadsheet className={`w-6 h-6 ${activeFeature === 'excel' ? 'text-white' : 'text-gray-600'
                    }`} />
                </div>
                <h3 className="text-lg font-bold">Excel Files</h3>
              </div>
              <p className="text-sm text-gray-600">Generate datasets with AI</p>
            </button>

            {/* Speaker Notes */}
            <button
              onClick={() => setActiveFeature('speaker-notes')}
              className={`p-6 rounded-2xl border-2 transition-all ${activeFeature === 'speaker-notes'
                ? 'border-primary-500 bg-gradient-to-br from-primary-50 to-accent-50 shadow-glow'
                : 'border-gray-200 bg-white hover:border-primary-300'
                }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${activeFeature === 'speaker-notes'
                  ? 'bg-gradient-to-br from-primary-500 to-accent-500'
                  : 'bg-gray-100'
                  }`}>
                  <Mic className={`w-6 h-6 ${activeFeature === 'speaker-notes' ? 'text-white' : 'text-gray-600'
                    }`} />
                </div>
                <h3 className="text-lg font-bold">Speaker Notes</h3>
              </div>
              <p className="text-sm text-gray-600">AI-generated presentation notes</p>
            </button>
          </div>
        </div>
      </section>

      {/* Generator Section */}
      <section id="generator" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          {/* Conditional Rendering Based on Active Feature */}
          {activeFeature === 'presentations' && (
            <>
              {/* Presentation Modes */}
              <div className="mb-16">
                <h2 className="text-3xl font-bold text-center mb-4">Choose Your Style</h2>
                <p className="text-center text-gray-600 mb-10">Select the presentation type that fits your needs</p>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {presentationModes.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setSelectedMode(mode.id)}
                      className={`group relative bg-white rounded-xl p-6 border-2 transition-all duration-300 hover:shadow-lg ${selectedMode === mode.id
                        ? 'border-primary-500 shadow-glow'
                        : 'border-gray-200 hover:border-primary-300'
                        }`}
                    >
                      <div className="text-center">
                        <div className="text-4xl mb-3">{mode.emoji}</div>
                        <h3 className="font-semibold mb-1 text-gray-900">{mode.name}</h3>
                        <p className="text-sm text-gray-600">{mode.description}</p>
                      </div>

                      {/* Selected Indicator */}
                      <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedMode === mode.id
                        ? 'border-primary-500 bg-primary-500'
                        : 'border-gray-300'
                        }`}>
                        {selectedMode === mode.id && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Upload Section */}
              <div className="max-w-4xl mx-auto mb-6">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-primary-600" />
                    Upload Your Custom Template
                  </h3>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      id="template-upload-save"
                      accept=".pptx,.ppt"
                      onChange={handleTemplateUpload}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    />
                    <p className="text-sm text-gray-600">Upload a .pptx template to use for all your presentations</p>
                  </div>
                </div>
              </div>

              {/* Input Section */}
              <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 p-8 md:p-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-6 h-6 text-primary-600" />
                      <h2 className="text-2xl font-bold">What would you like to present?</h2>
                    </div>

                    {/* Template Selection */}
                    <div className="flex items-center gap-3">
                      {/* Template Dropdown */}
                      <select
                        value={selectedTemplate}
                        onChange={(e) => {
                          setSelectedTemplate(e.target.value);
                        }}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none"
                      >
                        <option value="none">Choose Template</option>
                        {availableTemplates.map((template) => (
                          <option key={template._id} value={template._id}>
                            {template.name}
                          </option>
                        ))}
                      </select>

                    </div>
                  </div>

                  <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full h-40 px-6 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all resize-none outline-none placeholder:text-gray-400"
                    placeholder="Describe your presentation idea in detail... Be specific about what you want to cover, your audience, and the key points you want to highlight.



Example: Create a pitch deck for a SaaS startup that helps remote teams collaborate better. Target audience is venture capitalists. Include market size, problem statement, solution, business model, and traction slides."
                  />

                  {/* Error Message */}
                  {error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  )}

                  {/* Success Message */}
                  {success && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-green-800">{success}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-4 flex-wrap gap-4">
                    <span className="text-sm text-gray-500">{topic.length} / 1000 characters</span>
                    <button
                      onClick={handleGenerate}
                      disabled={!topic.trim() || isGenerating}
                      className="px-8 py-4 bg-gradient-to-r from-primary-600 to-accent-600 text-white text-lg font-semibold rounded-full hover:shadow-glow-lg hover:scale-105 transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5" />
                          Generate Presentation
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeFeature === 'excel' && (
            <ExcelGenerator token={token} onAuthError={async () => {
              try {
                await autoRegister();
                setToken(localStorage.getItem('token'));
              } catch (err) {
                setError('Authentication failed. Please refresh the page.');
              }
            }} />
          )}

          {activeFeature === 'speaker-notes' && (
            <SpeakerNotesGenerator token={token} onAuthError={async () => {
              try {
                await autoRegister();
                setToken(localStorage.getItem('token'));
              } catch (err) {
                setError('Authentication failed. Please refresh the page.');
              }
            }} />
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-primary-600">
                  <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
                </div>
                <span className="text-lg font-bold">CloudSlides</span>
              </div>
              <p className="text-gray-600 text-sm">AI-powered presentation generator for modern teams</p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-gray-900">Features</a></li>
                <li><a href="#" className="hover:text-gray-900">Pricing</a></li>
                <li><a href="#" className="hover:text-gray-900">Templates</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-gray-900">About</a></li>
                <li><a href="#" className="hover:text-gray-900">Blog</a></li>
                <li><a href="#" className="hover:text-gray-900">Careers</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-gray-900">Privacy</a></li>
                <li><a href="#" className="hover:text-gray-900">Terms</a></li>
                <li><a href="#" className="hover:text-gray-900">Contact</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-8 text-center text-sm text-gray-600">
            <p>© 2024 CloudSlides. All rights reserved. Powered by Claude AI.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

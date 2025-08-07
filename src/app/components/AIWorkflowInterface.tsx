'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Loader2, Sparkles, Palette, MessageSquare, RefreshCw, Download, X, Box, ImageIcon } from 'lucide-react';

interface AIWorkflowInterfaceProps {
  onImageGenerated?: (imageUrl: string, prompt: string) => void;
}

type WorkflowMode = 'image-generation' | 'claude-prompt' | 'coloring-book';

export default function AIWorkflowInterface({ onImageGenerated }: AIWorkflowInterfaceProps) {
  // Main state
  const [currentMode, setCurrentMode] = useState<WorkflowMode>('image-generation');
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Claude Prompt Generator state
  const [showClaudePrompt, setShowClaudePrompt] = useState(false);
  const [claudePrompt, setClaudePrompt] = useState('');
  const [generatingClaudePrompt, setGeneratingClaudePrompt] = useState(false);
  const [claudePromptError, setClaudePromptError] = useState('');

  // Coloring Book state
  const [coloringBookThing, setColoringBookThing] = useState('');
  const [coloringBookAction, setColoringBookAction] = useState('');
  const [coloringBookStyle, setColoringBookStyle] = useState('');
  const [coloringBookUrl, setColoringBookUrl] = useState('');
  const [generatingColoringBook, setGeneratingColoringBook] = useState(false);
  const [coloringBookError, setColoringBookError] = useState('');

  // Image generation parameters
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [negativePrompt, setNegativePrompt] = useState('');

  // Reset function
  const handleReset = () => {
    setPrompt('');
    setImageUrl('');
    setError('');
    setClaudePrompt('');
    setClaudePromptError('');
    setColoringBookThing('');
    setColoringBookAction('');
    setColoringBookStyle('');
    setColoringBookUrl('');
    setColoringBookError('');
    setCurrentMode('image-generation');
  };

  // Download function
  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save creation function
  const saveCreation = (type: 'image' | '3d-model' | 'coloring-book' | 'background-removed', url: string, prompt: string, additionalData?: any) => {
    try {
      const creation = {
        id: Date.now().toString(),
        [type === '3d-model' ? 'modelUrl' : 'imageUrl']: url,
        prompt,
        type,
        createdAt: new Date().toISOString(),
        userId: 'user', // You can replace this with actual user ID
        ...additionalData
      };

      // Get existing creations from localStorage
      const storageKey = `saved-${type === '3d-model' ? 'models' : type === 'coloring-book' ? 'coloring-books' : type === 'background-removed' ? 'background-removed' : 'images'}`;
      const existingCreations = JSON.parse(localStorage.getItem(storageKey) || '[]');
      
      // Add new creation to the beginning of the array
      existingCreations.unshift(creation);
      
      // Keep only the last 100 creations to avoid storage bloat
      const limitedCreations = existingCreations.slice(0, 100);
      
      // Save back to localStorage
      localStorage.setItem(storageKey, JSON.stringify(limitedCreations));
      
      console.log(`Saved ${type} creation:`, creation);
    } catch (error) {
      console.error('Error saving creation:', error);
    }
  };

  // Generate image function
  const generateImage = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError('');
    setImageUrl('');

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          aspect_ratio: aspectRatio,
          ...(negativePrompt && { negativePrompt })
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate image');
      }

      const data = await response.json();
      setImageUrl(data.imageUrl);
      
      // Save the image creation
      saveCreation('image', data.imageUrl, prompt, {
        aspectRatio,
        model: data.model || 'Google Imagen-4-Fast',
        negativePrompt
      });
      
      onImageGenerated?.(data.imageUrl, prompt);
    } catch (error) {
      console.error('Error generating image:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate image');
    } finally {
      setLoading(false);
    }
  };

  // Generate Claude prompt function
  const generateClaudePrompt = async () => {
    if (!prompt.trim()) {
      setClaudePromptError('Please enter a base prompt first');
      return;
    }

    setGeneratingClaudePrompt(true);
    setClaudePromptError('');

    try {
      const response = await fetch('/api/anthropic/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: `Enhance this prompt for image generation: "{{base_prompt}}". Make it more detailed, professional, and optimized for AI image generation. Include specific details about style, lighting, composition, and artistic elements.`,
          variables: { base_prompt: prompt }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate enhanced prompt');
      }

      const data = await response.json();
      setClaudePrompt(data.generatedPrompt);
    } catch (error) {
      console.error('Error generating Claude prompt:', error);
      setClaudePromptError(error instanceof Error ? error.message : 'Failed to generate enhanced prompt');
    } finally {
      setGeneratingClaudePrompt(false);
    }
  };

  // Generate coloring book function
  const generateColoringBook = async () => {
    if (!coloringBookThing || !coloringBookAction) {
      setColoringBookError('Please enter both subject and action');
      return;
    }

    setGeneratingColoringBook(true);
    setColoringBookError('');

    try {
      const response = await fetch('/api/anthropic/coloring-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thing: coloringBookThing,
          action: coloringBookAction,
          ...(coloringBookStyle && { style: coloringBookStyle })
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate coloring book');
      }

      const data = await response.json();
      setColoringBookUrl(data.imageUrl);
      
      // Save the coloring book creation
      const fullPrompt = `Coloring book: ${coloringBookThing} ${coloringBookAction}${coloringBookStyle ? ` in ${coloringBookStyle} style` : ''}`;
      saveCreation('coloring-book', data.imageUrl, fullPrompt, {
        thing: coloringBookThing,
        action: coloringBookAction,
        style: coloringBookStyle,
        generatedPrompt: data.generatedPrompt
      });
    } catch (error) {
      console.error('Error generating coloring book:', error);
      setColoringBookError(error instanceof Error ? error.message : 'Failed to generate coloring book');
    } finally {
      setGeneratingColoringBook(false);
    }
  };

  // Generate 3D model function
  const generate3DModel = async () => {
    if (!imageUrl) {
      setError('Please generate an image first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/generate-3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imageUrl,
          prompt: prompt || "A detailed 3D model"
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate 3D model');
      }

      const data = await response.json();
      
      // Save the 3D model creation
      saveCreation('3d-model', data.modelUrl, prompt, {
        sourceImageUrl: imageUrl,
        generationTime: data.generationTime
      });
      
      // You could set a state to show the 3D model was generated
      console.log('3D model generated successfully:', data.modelUrl);
    } catch (error) {
      console.error('Error generating 3D model:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate 3D model');
    } finally {
      setLoading(false);
    }
  };

  // Remove background function
  const removeBackground = async (imageUrl: string, originalPrompt: string) => {
    setLoading(true);
    setError('');

    try {
      // Convert image URL to blob/file
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], 'image.png', { type: 'image/png' });
      
      const formData = new FormData();
      formData.append('image_file', file);
      formData.append('transparency_handling', 'return_input_if_non_opaque');
      
      const bgRemovalResponse = await fetch('/api/clipdrop/remove-background', {
        method: 'POST',
        body: formData,
      });

      if (!bgRemovalResponse.ok) {
        const errorData = await bgRemovalResponse.json();
        throw new Error(errorData.error || 'Failed to remove background');
      }

      const imageBlob = await bgRemovalResponse.blob();
      
      // Convert blob to data URL
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(imageBlob);
      });
      
      // Save the background removed creation
      saveCreation('background-removed', dataUrl, originalPrompt, {
        originalImageUrl: imageUrl
      });
      
      console.log('Background removed successfully');
    } catch (error) {
      console.error('Error removing background:', error);
      setError(error instanceof Error ? error.message : 'Failed to remove background');
    } finally {
      setLoading(false);
    }
  };

  // Use Claude prompt
  const useClaudePrompt = () => {
    if (claudePrompt) {
      setPrompt(claudePrompt);
      setShowClaudePrompt(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Mode Selector */}
      <div className="bg-slate-800/90 backdrop-blur-xl rounded-xl border border-slate-700 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold gradient-text">
              AI Creative Studio
            </h1>
            <p className="text-slate-400 mt-2">Choose your creative workflow</p>
          </div>
          
          <div className="flex items-center space-x-2 bg-slate-900/70 px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-700">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span>AI Ready</span>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => setCurrentMode('image-generation')}
            className={`p-4 rounded-lg border transition-all ${
              currentMode === 'image-generation'
                ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                : 'bg-slate-800/50 border-slate-600 text-slate-400 hover:bg-slate-700/50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Sparkles className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Image Generation</div>
                <div className="text-xs opacity-75">Create images from text</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => setCurrentMode('claude-prompt')}
            className={`p-4 rounded-lg border transition-all ${
              currentMode === 'claude-prompt'
                ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                : 'bg-slate-800/50 border-slate-600 text-slate-400 hover:bg-slate-700/50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <MessageSquare className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Claude Prompt</div>
                <div className="text-xs opacity-75">Enhance prompts with AI</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => setCurrentMode('coloring-book')}
            className={`p-4 rounded-lg border transition-all ${
              currentMode === 'coloring-book'
                ? 'bg-orange-600/20 border-orange-500 text-orange-300'
                : 'bg-slate-800/50 border-slate-600 text-slate-400 hover:bg-slate-700/50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Palette className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Coloring Book</div>
                <div className="text-xs opacity-75">Create coloring pages</div>
              </div>
            </div>
          </button>
        </div>

        {/* Reset Button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Start Over</span>
          </button>
        </div>
      </div>

      {/* Image Generation Mode */}
      {currentMode === 'image-generation' && (
        <div className="bg-slate-800/90 backdrop-blur-xl rounded-xl border border-slate-700 p-6 shadow-xl">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-200 mb-4">Image Generation</h2>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what you want to create..."
                className="w-full p-4 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>

            {/* Advanced Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Aspect Ratio</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                >
                  <option value="1:1">Square (1:1)</option>
                  <option value="4:3">Landscape (4:3)</option>
                  <option value="3:4">Portrait (3:4)</option>
                  <option value="16:9">Wide (16:9)</option>
                  <option value="9:16">Tall (9:16)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Negative Prompt</label>
                <input
                  type="text"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="What to avoid..."
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={generateImage}
                disabled={loading || !prompt.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Image
                  </span>
                )}
              </button>

              <button
                onClick={() => setShowClaudePrompt(!showClaudePrompt)}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>

            {/* Claude Prompt Helper */}
            {showClaudePrompt && (
              <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-purple-300">Enhance Prompt with Claude</h3>
                  <button
                    onClick={() => setShowClaudePrompt(false)}
                    className="text-purple-400 hover:text-purple-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <p className="text-sm text-slate-400">
                  Let Claude AI enhance your prompt for better image generation results.
                </p>

                <button
                  onClick={generateClaudePrompt}
                  disabled={generatingClaudePrompt || !prompt.trim()}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {generatingClaudePrompt ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enhancing...
                    </span>
                  ) : (
                    'Enhance with Claude'
                  )}
                </button>

                {claudePromptError && (
                  <div className="text-red-400 text-sm">{claudePromptError}</div>
                )}

                {claudePrompt && (
                  <div className="space-y-3">
                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
                      <p className="text-sm text-slate-200">{claudePrompt}</p>
                    </div>
                    <button
                      onClick={useClaudePrompt}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      Use This Prompt
                    </button>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg p-4">
                <p className="text-red-400">{error}</p>
              </div>
            )}

            {imageUrl && (
              <div className="space-y-4">
                <div className="relative group overflow-hidden rounded-lg shadow-lg border border-slate-700">
                  <Image
                    src={imageUrl}
                    alt="Generated image"
                    width={800}
                    height={600}
                    className="w-full h-auto object-contain"
                  />
                </div>
                
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={() => downloadImage(imageUrl, `generated-image-${Date.now()}.png`)}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                  
                  <button
                    onClick={() => generate3DModel()}
                    disabled={loading}
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Box className="w-4 h-4" />
                    <span>Generate 3D Model</span>
                  </button>
                  
                  <button
                    onClick={() => removeBackground(imageUrl, prompt)}
                    disabled={loading}
                    className="flex items-center space-x-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Remove Background</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Claude Prompt Mode */}
      {currentMode === 'claude-prompt' && (
        <div className="bg-slate-800/90 backdrop-blur-xl rounded-xl border border-slate-700 p-6 shadow-xl">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-200 mb-4">Claude Prompt Enhancement</h2>
              <p className="text-slate-400 mb-4">
                Let Claude AI enhance your prompts for better image generation results.
              </p>
              
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your base prompt here..."
                className="w-full p-4 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows={4}
              />
            </div>

            <button
              onClick={generateClaudePrompt}
              disabled={generatingClaudePrompt || !prompt.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generatingClaudePrompt ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enhancing with Claude...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Enhance Prompt
                </span>
              )}
            </button>

            {claudePromptError && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg p-4">
                <p className="text-red-400">{claudePromptError}</p>
              </div>
            )}

            {claudePrompt && (
              <div className="space-y-4">
                <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-purple-300 mb-3">Enhanced Prompt</h3>
                  <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
                    <p className="text-sm text-slate-200 whitespace-pre-wrap">{claudePrompt}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setCurrentMode('image-generation')}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    Generate Image with This Prompt
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Coloring Book Mode */}
      {currentMode === 'coloring-book' && (
        <div className="bg-slate-800/90 backdrop-blur-xl rounded-xl border border-slate-700 p-6 shadow-xl">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-200 mb-4">Coloring Book Creator</h2>
              <p className="text-slate-400 mb-4">
                Create custom coloring book pages with Claude AI.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Subject</label>
                <input
                  type="text"
                  value={coloringBookThing}
                  onChange={(e) => setColoringBookThing(e.target.value)}
                  placeholder="e.g., cat, dragon, castle"
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Action</label>
                <input
                  type="text"
                  value={coloringBookAction}
                  onChange={(e) => setColoringBookAction(e.target.value)}
                  placeholder="e.g., sitting, flying, dancing"
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Style (optional)</label>
              <input
                type="text"
                value={coloringBookStyle}
                onChange={(e) => setColoringBookStyle(e.target.value)}
                placeholder="e.g., cartoon, detailed, simple"
                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500"
              />
            </div>

            <button
              onClick={generateColoringBook}
              disabled={generatingColoringBook || !coloringBookThing || !coloringBookAction}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generatingColoringBook ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Coloring Book...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <Palette className="w-4 h-4 mr-2" />
                  Generate Coloring Book
                </span>
              )}
            </button>

            {coloringBookError && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg p-4">
                <p className="text-red-400">{coloringBookError}</p>
              </div>
            )}

            {coloringBookUrl && (
              <div className="space-y-4">
                <div className="relative group overflow-hidden rounded-lg shadow-lg border border-slate-700">
                  <Image
                    src={coloringBookUrl}
                    alt="Generated coloring book"
                    width={800}
                    height={600}
                    className="w-full h-auto object-contain bg-white"
                  />
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => downloadImage(coloringBookUrl, `coloring-book-${Date.now()}.png`)}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 
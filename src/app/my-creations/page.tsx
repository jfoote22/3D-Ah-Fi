'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Download, Trash2, Eye, Search, Filter, Grid, List, Calendar, Image as ImageIcon, Box, Palette, Rocket, Quote, Copy, RefreshCw } from 'lucide-react';
import { useWorkflowStore } from '@/lib/stores/workflow-store'
import { listUserCreations, deleteCreationById, listUserPrompts, deletePromptById } from '@/lib/firebase/firebaseUtils'
import dynamic from 'next/dynamic'

const DynamicModelViewer = dynamic(() => import('@/app/components/ModelViewer'), { ssr: false })

interface SavedCreation {
  id: string;
  imageUrl?: string;
  modelUrl?: string;
  prompt: string;
  type: 'image' | '3d-model' | 'coloring-book' | 'background-removed';
  createdAt: any;
  userId: string;
  aspectRatio?: string;
  model?: string;
}

export default function MyCreations() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [creations, setCreations] = useState<SavedCreation[]>([]);
  const [filteredCreations, setFilteredCreations] = useState<SavedCreation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loadingCreations, setLoadingCreations] = useState(true);
  const [prompts, setPrompts] = useState<any[]>([]);

  // New state for copy/rerun
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState('')
  const [editingCreationId, setEditingCreationId] = useState<string | null>(null)
  const [isRerunning, setIsRerunning] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const loadCreations = useCallback(async () => {
    setLoadingCreations(true);
    try {
      const items = await listUserCreations(user!.uid);
      const sorted = (items || []).sort((a: any, b: any) => {
        const ad = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
        const bd = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
        return bd - ad;
      });
      setCreations(sorted as any);
    } catch (error) {
      console.error('Error loading creations:', error);
    } finally {
      setLoadingCreations(false);
    }
  }, [user])

  const loadPrompts = useCallback(async () => {
    try {
      const data = await listUserPrompts(user!.uid)
      setPrompts(data.sort((a: any, b: any) => {
        const ad = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0
        const bd = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0
        return bd - ad
      }))
    } catch (e) {
      console.error('Error loading prompts', e)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadCreations();
      loadPrompts();
    }
  }, [user, loadCreations, loadPrompts]);

  const filterCreations = useCallback(() => {
    let filtered = creations;

    if (searchTerm) {
      filtered = filtered.filter(creation =>
        creation.prompt.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter(creation => creation.type === selectedType);
    }

    setFilteredCreations(filtered);
  }, [creations, searchTerm, selectedType])

  useEffect(() => {
    filterCreations();
  }, [filterCreations]);

  // Add missing prompt helpers for Saved Prompts actions
  const deletePrompt = async (id: string) => {
    try {
      await deletePromptById(id)
      setPrompts(prev => prev.filter(p => p.id !== id))
    } catch (e) {
      console.error('Error deleting prompt', e)
    }
  }

  const reusePrompt = (text: string) => {
    const setPrompt = useWorkflowStore.getState().setPrompt
    const addToPromptHistory = useWorkflowStore.getState().addToPromptHistory
    const setCurrentStep = useWorkflowStore.getState().setCurrentStep
    setPrompt(text)
    addToPromptHistory(text)
    setCurrentStep('generate')
    router.push('/')
  }

  const deleteCreation = async (id: string, type: string) => {
    try {
      await deleteCreationById(id);
      setCreations(prev => prev.filter(creation => creation.id !== id));
    } catch (error) {
      console.error('Error deleting creation:', error);
    }
  };

  const addGeneratedImage = useWorkflowStore(s => s.addGeneratedImage)
  const updateImageBackgroundRemoved = useWorkflowStore(s => s.updateImageBackgroundRemoved)
  const setSelectedImage = useWorkflowStore(s => s.setSelectedImage)
  const addGeneratedModel = useWorkflowStore(s => s.addGeneratedModel)
  const setCurrentStep = useWorkflowStore(s => s.setCurrentStep)

  const openInStudio = (creation: SavedCreation) => {
    if (creation.type === '3d-model' && creation.modelUrl) {
      addGeneratedModel({
        id: creation.id,
        url: creation.modelUrl,
        sourceImageId: '',
        timestamp: Date.now(),
        metadata: {}
      })
      setCurrentStep('export')
      router.push('/')
      return
    }

    if (creation.imageUrl) {
      const imageId = `${creation.id}`
      addGeneratedImage({
        id: imageId,
        url: creation.imageUrl,
        prompt: creation.prompt,
        timestamp: Date.now(),
        metadata: { aspectRatio: creation.aspectRatio, model: creation.model }
      })
      setSelectedImage(imageId)
      if (creation.type === 'background-removed') {
        updateImageBackgroundRemoved(imageId, creation.imageUrl)
      }
      setCurrentStep('enhance')
      router.push('/')
    }
  }

  const downloadCreation = (creation: SavedCreation) => {
    const url = creation.imageUrl || creation.modelUrl;
    if (!url) return;

    const filename = `${creation.type}-${creation.prompt.slice(0, 30).replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-')}-${new Date(creation.createdAt).toISOString().slice(0, 19).replace(/[:-]/g, '')}.${creation.type === '3d-model' ? 'glb' : 'png'}`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateValue: any) => {
    const ms = typeof dateValue === 'string' || typeof dateValue === 'number'
      ? new Date(dateValue).getTime()
      : dateValue?.toMillis
        ? dateValue.toMillis()
        : Date.now()
    return new Date(ms).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const copyPrompt = async (creation: SavedCreation) => {
    try {
      await navigator.clipboard.writeText(creation.prompt)
      setCopiedId(creation.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {}
  }

  const openRerunModal = (creation: SavedCreation) => {
    setEditingCreationId(creation.id)
    setEditingPrompt(creation.prompt)
    setIsModalOpen(true)
  }

  const runRerun = async () => {
    if (!editingCreationId || !editingPrompt.trim()) return
    setIsRerunning(true)
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: editingPrompt.trim(), aspect_ratio: '1:1' })
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to generate image')
      }
      const data = await response.json()
      if (data.imageUrl) {
        const newId = Date.now().toString()
        addGeneratedImage({
          id: newId,
          url: data.imageUrl,
          prompt: editingPrompt.trim(),
          timestamp: Date.now(),
          metadata: { model: data.model, generationTime: data.generationTime, aspectRatio: data.aspect_ratio }
        })
        setSelectedImage(newId)
        setCurrentStep('enhance')
        setIsModalOpen(false)
        router.push('/')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsRerunning(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-900/50 border-t-blue-500 rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-blue-400 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-4">My Creations</h1>
          <p className="text-muted-foreground">View and manage all your AI-generated content</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg"
          >
            <Rocket className="w-4 h-4" />
            Back to Studio
          </button>
        </div>

        {/* Controls */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-xl mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search your creations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="image">Images</option>
                <option value="3d-model">3D Models</option>
                <option value="coloring-book">Coloring Books</option>
                <option value="background-removed">Background Removed</option>
              </select>

              {/* View Mode Toggle */}
              <div className="flex bg-muted rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {loadingCreations ? (
          <div className="flex justify-center items-center py-16">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4 mx-auto"></div>
              <p className="text-primary font-medium">Loading your creations...</p>
            </div>
          </div>
        ) : filteredCreations.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No creations found</h3>
            <p className="text-muted-foreground mb-6">
              {searchTerm || selectedType !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Start creating amazing content with AI!'
              }
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Start Creating
            </button>
          </div>
        ) : (
          <div className={`${
            viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
              : 'space-y-4'
          }`}>
            {filteredCreations.map((creation) => (
              <div
                key={creation.id}
                className={`bg-card rounded-xl border border-border shadow-xl overflow-hidden ${
                  viewMode === 'list' ? 'flex' : ''
                }`}
              >
                {/* Image/Preview */}
                <div className={`relative ${
                  viewMode === 'list' ? 'w-32 h-32 flex-shrink-0' : 'aspect-square'
                }`}>
                  {creation.imageUrl ? (
                    <Image
                      src={creation.imageUrl}
                      alt={creation.prompt}
                      width={400}
                      height={400}
                      className="w-full h-full object-cover"
                    />
                  ) : creation.type === '3d-model' && creation.modelUrl ? (
                    <div className="w-full h-full bg-background">
                      <DynamicModelViewer src={creation.modelUrl} alt="Saved 3D model" className="h-48" />
                    </div>
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                  
                  {/* Type Badge */}
                  <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1 border border-border">
                    {creation.type === 'image' || creation.type === 'background-removed' || creation.type === 'coloring-book' ? (
                      <ImageIcon className="w-4 h-4" />
                    ) : (
                      <Box className="w-4 h-4" />
                    )}
                    <span className="text-xs text-foreground/80">{creation.type.replace('-', ' ')}</span>
                  </div>
                </div>

                {/* Content */}
                <div className={`p-4 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="text-sm text-foreground font-medium line-clamp-2 mb-2">
                        {creation.prompt}
                      </p>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3 mr-1" />
                        {formatDate(creation.createdAt)}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => downloadCreation(creation)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm rounded-lg transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </button>
                    <button
                      onClick={() => openInStudio(creation)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm rounded-lg transition-colors"
                    >
                      <Rocket className="w-3 h-3" />
                      Use in Studio
                    </button>
                    <button
                      onClick={() => copyPrompt(creation)}
                      className="px-3 py-2 bg-muted hover:bg-muted/80 text-foreground border border-border text-sm rounded-lg transition-colors"
                      title="Copy prompt"
                    >
                      {copiedId === creation.id ? 'Copied!' : (
                        <span className="inline-flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</span>
                      )}
                    </button>
                    <button
                      onClick={() => openRerunModal(creation)}
                      className="px-3 py-2 bg-accent hover:bg-accent/80 text-accent-foreground text-sm rounded-lg transition-colors"
                      title="Edit prompt and re-run"
                    >
                      Re-run
                    </button>
                    <button
                      onClick={() => deleteCreation(creation.id, creation.type)}
                      className="px-3 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm rounded-lg transition-colors"
                      title="Delete creation"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Saved Prompts */}
        {prompts.length > 0 && (
          <div className="mt-10 bg-card rounded-xl border border-border p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Quote className="w-5 h-5" /> Saved Prompts
            </h2>
            <div className="space-y-3">
              {prompts.map((p) => (
                <div key={p.id} className="flex items-start justify-between gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="text-foreground text-sm flex-1 whitespace-pre-wrap">{p.text}</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => reusePrompt(p.text)}
                      className="px-3 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs rounded-lg"
                    >
                      Use
                    </button>
                    <button
                      onClick={() => deletePrompt(p.id)}
                      className="px-3 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs rounded-lg"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Re-run Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-foreground mb-3">Edit Prompt & Re-run</h3>
            <p className="text-sm text-muted-foreground mb-4">Update the prompt below and generate a new image. Your existing image will remain saved.</p>
            <textarea
              value={editingPrompt}
              onChange={(e) => setEditingPrompt(e.target.value)}
              className="w-full h-40 p-3 bg-background border border-border rounded-lg text-foreground"
              placeholder="Edit your prompt..."
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 border border-border text-foreground rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={runRerun}
                disabled={isRerunning || !editingPrompt.trim()}
                className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground rounded-lg inline-flex items-center gap-2"
              >
                {isRerunning ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</>) : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Download, Trash2, Eye, Search, Filter, Grid, List, Calendar, Image as ImageIcon, Box, Palette } from 'lucide-react';

interface SavedCreation {
  id: string;
  imageUrl?: string;
  modelUrl?: string;
  prompt: string;
  type: 'image' | '3d-model' | 'coloring-book' | 'background-removed';
  createdAt: string;
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

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadCreations();
    }
  }, [user]);

  useEffect(() => {
    filterCreations();
  }, [creations, searchTerm, selectedType]);

  const loadCreations = () => {
    setLoadingCreations(true);
    try {
      // Load from localStorage
      const savedImages = JSON.parse(localStorage.getItem('saved-images') || '[]');
      const savedModels = JSON.parse(localStorage.getItem('saved-models') || '[]');
      const savedColoringBooks = JSON.parse(localStorage.getItem('saved-coloring-books') || '[]');
      const savedBackgroundRemoved = JSON.parse(localStorage.getItem('saved-background-removed') || '[]');

      // Combine all creations and sort by creation date
      const allCreations = [
        ...savedImages.map((item: any) => ({ ...item, type: 'image' as const })),
        ...savedModels.map((item: any) => ({ ...item, type: '3d-model' as const })),
        ...savedColoringBooks.map((item: any) => ({ ...item, type: 'coloring-book' as const })),
        ...savedBackgroundRemoved.map((item: any) => ({ ...item, type: 'background-removed' as const }))
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setCreations(allCreations);
    } catch (error) {
      console.error('Error loading creations:', error);
    } finally {
      setLoadingCreations(false);
    }
  };

  const filterCreations = () => {
    let filtered = creations;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(creation =>
        creation.prompt.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter(creation => creation.type === selectedType);
    }

    setFilteredCreations(filtered);
  };

  const deleteCreation = (id: string, type: string) => {
    try {
      // Remove from localStorage
      const storageKey = `saved-${type === '3d-model' ? 'models' : type === 'coloring-book' ? 'coloring-books' : type === 'background-removed' ? 'background-removed' : 'images'}`;
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const updated = stored.filter((item: any) => item.id !== id);
      localStorage.setItem(storageKey, JSON.stringify(updated));

      // Update state
      setCreations(prev => prev.filter(creation => creation.id !== id));
    } catch (error) {
      console.error('Error deleting creation:', error);
    }
  };

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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="w-4 h-4" />;
      case '3d-model':
        return <Box className="w-4 h-4" />;
      case 'coloring-book':
        return <Palette className="w-4 h-4" />;
      case 'background-removed':
        return <ImageIcon className="w-4 h-4" />;
      default:
        return <ImageIcon className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'image':
        return 'Image';
      case '3d-model':
        return '3D Model';
      case 'coloring-book':
        return 'Coloring Book';
      case 'background-removed':
        return 'Background Removed';
      default:
        return 'Creation';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 py-12">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-4">My Creations</h1>
          <p className="text-slate-400">View and manage all your AI-generated content</p>
        </div>

        {/* Controls */}
        <div className="bg-slate-800/90 backdrop-blur-xl rounded-xl border border-slate-700 p-6 shadow-xl mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search your creations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="image">Images</option>
                <option value="3d-model">3D Models</option>
                <option value="coloring-book">Coloring Books</option>
                <option value="background-removed">Background Removed</option>
              </select>

              {/* View Mode Toggle */}
              <div className="flex bg-slate-900 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
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
              <div className="w-16 h-16 border-4 border-blue-900/50 border-t-blue-500 rounded-full animate-spin mb-4 mx-auto"></div>
              <p className="text-blue-400 font-medium">Loading your creations...</p>
            </div>
          </div>
        ) : filteredCreations.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="w-12 h-12 text-slate-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No creations found</h3>
            <p className="text-slate-400 mb-6">
              {searchTerm || selectedType !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Start creating amazing content with AI!'
              }
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
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
                className={`bg-slate-800/90 backdrop-blur-xl rounded-xl border border-slate-700 shadow-xl overflow-hidden ${
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
                  ) : creation.type === '3d-model' ? (
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                      <Box className="w-12 h-12 text-slate-600" />
                      <span className="text-slate-400 text-sm ml-2">3D Model</span>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-slate-600" />
                    </div>
                  )}
                  
                  {/* Type Badge */}
                  <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1">
                    {getTypeIcon(creation.type)}
                    <span className="text-xs text-slate-300">{getTypeLabel(creation.type)}</span>
                  </div>
                </div>

                {/* Content */}
                <div className={`p-4 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="text-sm text-slate-300 font-medium line-clamp-2 mb-2">
                        {creation.prompt}
                      </p>
                      <div className="flex items-center text-xs text-slate-500">
                        <Calendar className="w-3 h-3 mr-1" />
                        {formatDate(creation.createdAt)}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadCreation(creation)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </button>
                    <button
                      onClick={() => deleteCreation(creation.id, creation.type)}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
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

        {/* Stats */}
        {!loadingCreations && creations.length > 0 && (
          <div className="mt-8 bg-slate-800/50 rounded-lg p-4">
            <div className="flex flex-wrap gap-6 text-sm text-slate-400">
              <div>Total: {creations.length} creations</div>
              <div>Images: {creations.filter(c => c.type === 'image').length}</div>
              <div>3D Models: {creations.filter(c => c.type === '3d-model').length}</div>
              <div>Coloring Books: {creations.filter(c => c.type === 'coloring-book').length}</div>
              <div>Background Removed: {creations.filter(c => c.type === 'background-removed').length}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 
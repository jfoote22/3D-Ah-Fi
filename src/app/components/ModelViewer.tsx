'use client';

import { useEffect, useRef, useState } from 'react';

interface ModelViewerProps {
  src: string;
  alt?: string;
  poster?: string;
  className?: string;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src: string;
        alt?: string;
        poster?: string;
        'auto-rotate'?: boolean;
        'camera-controls'?: boolean;
        'shadow-intensity'?: string | number;
        'environment-image'?: string;
        'ar'?: boolean;
        'rotation-per-second'?: string;
        'field-of-view'?: string;
        'exposure'?: string;
        'interaction-policy'?: string;
        'animation-name'?: string;
        'camera-orbit'?: string;
        'skybox-image'?: string;
      }, HTMLElement>;
    }
  }
}

export default function ModelViewer({ src, alt = 'A 3D model', poster, className = '' }: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    // Dynamically import the @google/model-viewer script
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@1.12.0/dist/model-viewer.min.js';
    script.type = 'module';
    document.body.appendChild(script);

    script.onload = () => {
      setIsLoaded(true);
    };

    script.onerror = () => {
      setIsError(true);
    };

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div ref={containerRef} className={`model-viewer-container ${className}`}>
      <div className="relative">
        {/* Gradient background for the model viewer */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-lg z-0"></div>
        
        {/* Loading state */}
        {!isLoaded && !isError && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-900/90 backdrop-blur rounded-lg">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-900/50 border-t-blue-500 rounded-full animate-spin mb-3"></div>
              <p className="text-blue-400 font-medium">Loading 3D viewer...</p>
            </div>
          </div>
        )}
        
        {/* Error state */}
        {isError && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-red-900/20 backdrop-blur rounded-lg">
            <div className="text-center p-6">
              <div className="w-12 h-12 mx-auto text-red-500 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-red-400 font-medium">Failed to load 3D viewer</p>
              <p className="text-red-300 text-sm mt-1">Please try again or download the model directly</p>
            </div>
          </div>
        )}
        
        <model-viewer
          src={src}
          alt={alt}
          poster={poster}
          auto-rotate
          camera-controls
          shadow-intensity="1"
          environment-image="neutral"
          ar
          rotation-per-second="30deg"
          field-of-view="30deg"
          exposure="0.5"
          camera-orbit="0deg 75deg 105%"
          interaction-policy="allow-when-focused"
          style={{ 
            width: '100%', 
            height: '350px',
            backgroundColor: 'transparent',
            borderRadius: '0.5rem',
            position: 'relative',
            zIndex: '10'
          }}
          onLoad={() => console.log('Model loaded successfully')}
          onError={(error: any) => {
            console.error('Error loading 3D model:', error);
            setIsError(true);
          }}
        >
          {/* Custom controls overlay */}
          <div slot="controls" className="absolute bottom-3 right-3 bg-slate-800/80 backdrop-blur-sm p-1.5 rounded-lg shadow-md z-30 flex items-center space-x-1 border border-slate-700">
            <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-blue-400">
              <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
              </svg>
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-blue-400">
              <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          {/* Loading indicator inside model viewer */}
          <div slot="poster" className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-900/50 border-t-blue-500 rounded-full animate-spin mb-4"></div>
              <p className="text-blue-400 font-medium">Loading 3D model...</p>
              <p className="text-slate-500 text-xs mt-2">Please wait, this may take a moment</p>
            </div>
          </div>
        </model-viewer>
      </div>
    </div>
  );
} 
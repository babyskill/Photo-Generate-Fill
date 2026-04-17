import React, { useState, useEffect } from 'react';
import { Key } from 'lucide-react';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export function ApiKeyGuard({ children }: { children: React.ReactNode }) {
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const result = await window.aistudio.hasSelectedApiKey();
        setHasKey(result);
      } else {
        // Fallback if not in AI Studio environment
        setHasKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success as per instructions to avoid race conditions
      setHasKey(true);
    }
  };

  if (hasKey === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-8 bg-blue-400 rounded-full mb-4"></div>
          <div className="text-gray-500 font-medium">Checking API Key...</div>
        </div>
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-6 border border-gray-100">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <Key size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">API Key Required</h1>
            <p className="text-gray-600 leading-relaxed">
              To generate high-resolution images (2K/4K) with Gemini 3.1 Flash Image, you need to select a paid Google Cloud API key.
            </p>
          </div>
          <button
            onClick={handleSelectKey}
            className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            Select API Key
          </button>
          <p className="text-sm text-gray-500">
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline transition-colors">
              Learn more about billing
            </a>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

import { useState } from 'react';
import { saveApiKey } from '../lib/api';

interface Props {
  onSave: () => void;
}

export function ApiKeyModal({ onSave }: Props) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    saveApiKey(value.trim());
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold text-white">API Key required</h2>
        <p className="mb-4 text-sm text-gray-400">
          Enter your API key to access the Cache Warmer dashboard.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter API key"
            className="rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Save
          </button>
        </form>
      </div>
    </div>
  );
}

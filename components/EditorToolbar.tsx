import React from 'react';
import { Sparkles } from 'lucide-react';

interface EditorToolbarProps {
    onOpenAI: () => void;
    onOpenSummary: () => void;
    chapterTitle?: string;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ onOpenAI }) => {
    return (
        <div className="h-12 border-b border-gray-800/50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-end px-4 shrink-0 z-10">
            <button
                onClick={onOpenAI}
                className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-md transition-colors shadow-lg shadow-indigo-500/20"
            >
                <Sparkles className="w-4 h-4" />
                <span>AI 助手</span>
            </button>
        </div>
    );
};

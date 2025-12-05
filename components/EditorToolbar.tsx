import React from 'react';
import { Sparkles, AlignLeft } from 'lucide-react';

interface EditorToolbarProps {
    onOpenAI: () => void;
    onOpenSummary: () => void;
    chapterTitle?: string;
    onAutoFormat?: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ onOpenAI, onAutoFormat }) => {
    return (
        <div className="h-12 border-b border-gray-800/50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-between px-4 shrink-0 z-10">
            <div className="flex items-center gap-2">
                {onAutoFormat && (
                    <button
                        onClick={onAutoFormat}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
                        title="自动排版"
                    >
                        <AlignLeft className="w-4 h-4" />
                        <span>自动排版</span>
                    </button>
                )}
            </div>

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

import React from 'react';
import { FileText } from 'lucide-react';
import { Chapter } from '../types';

interface EditorProps {
  chapter: Chapter;
  onChange: (content: string) => void;
  onTitleChange: (title: string) => void;
  onOpenSummary: () => void;
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
}

export const Editor: React.FC<EditorProps> = ({ chapter, onChange, onTitleChange, onOpenSummary, fontSize }) => {

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'small': return 'text-base';
      case 'medium': return 'text-lg';
      case 'large': return 'text-xl';
      case 'xlarge': return 'text-2xl';
      default: return 'text-lg';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-gray-950">
      {/* Header with title */}
      <div className="px-6 pt-4 pb-2 border-b border-gray-800/50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <input
            type="text"
            value={chapter.title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="bg-transparent text-2xl font-serif font-bold text-gray-100 border-none focus:ring-0 placeholder-gray-700 flex-1 outline-none"
            placeholder="章节标题"
          />
          <div className="flex items-center gap-4 ml-4">
            <button
              onClick={onOpenSummary}
              className="flex items-center text-sm text-gray-500 hover:text-indigo-400 transition-colors group shrink-0"
            >
              <FileText className="w-4 h-4 mr-1.5 group-hover:scale-110 transition-transform" />
              {chapter.summary ? '概要' : '添加概要'}
              {chapter.summary && <span className="ml-1.5 w-2 h-2 rounded-full bg-indigo-500"></span>}
            </button>
            <div className="text-xs text-gray-600">
              {chapter.content.length} 字
            </div>
          </div>
        </div>
      </div>

      {/* Writing area - full width */}
      <div className="flex-1 overflow-hidden">
        <textarea
          value={chapter.content}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full h-full bg-transparent font-serif text-gray-300 leading-loose resize-none border-none focus:ring-0 outline-none placeholder-gray-700 custom-scrollbar px-6 py-4 ${getFontSizeClass()}`}
          placeholder="在此处开始你的故事..."
          spellCheck={false}
          style={{ lineHeight: '2' }}
        />
      </div>
    </div>
  );
};

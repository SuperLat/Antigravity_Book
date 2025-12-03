
import React from 'react';
import { Chapter } from '../types';

interface EditorProps {
  chapter: Chapter;
  onChange: (content: string) => void;
  onTitleChange: (title: string) => void;
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
}

export const Editor: React.FC<EditorProps> = ({ chapter, onChange, onTitleChange, fontSize }) => {
  
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
    <div className="flex-1 flex flex-col h-full bg-gray-950 relative">
      <div className="max-w-3xl mx-auto w-full h-full flex flex-col pt-8 px-8 pb-4">
        <input
          type="text"
          value={chapter.title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="bg-transparent text-3xl font-serif font-bold text-gray-100 border-none focus:ring-0 placeholder-gray-700 mb-6 w-full outline-none"
          placeholder="章节标题"
        />
        <textarea
          value={chapter.content}
          onChange={(e) => onChange(e.target.value)}
          className={`flex-1 w-full bg-transparent font-serif text-gray-300 leading-relaxed resize-none border-none focus:ring-0 outline-none placeholder-gray-800 custom-scrollbar ${getFontSizeClass()}`}
          placeholder="在此处开始你的故事..."
          spellCheck={false}
        />
        <div className="text-xs text-gray-600 text-right mt-2">
           {chapter.content.length} 字
        </div>
      </div>
    </div>
  );
};

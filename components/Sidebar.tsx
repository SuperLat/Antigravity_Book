
import React from 'react';
import { Book, FileText, BookOpen, Settings, Library, Database, ChevronLeft, LayoutDashboard } from 'lucide-react';
import { Book as BookType } from '../types';

interface SidebarProps {
  book: BookType;
  activeChapterId: string;
  onSelectChapter: (id: string) => void;
  onCreateChapter: () => void;
  activeView: 'editor' | 'wiki';
  onSelectView: (view: 'editor' | 'wiki') => void;
  onBackToShelf: () => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  book, 
  activeChapterId, 
  onSelectChapter,
  onCreateChapter,
  activeView,
  onSelectView,
  onBackToShelf,
  onOpenSettings
}) => {
  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <button 
          onClick={onBackToShelf}
          className="flex items-center text-xs text-gray-500 hover:text-indigo-400 transition-colors mb-3 group"
        >
          <ChevronLeft className="w-3 h-3 mr-1 group-hover:-translate-x-0.5 transition-transform" />
          返回书架
        </button>
        <div className="flex items-center space-x-2">
          <Book className="w-5 h-5 text-indigo-400" />
          <h1 className="font-bold text-gray-100 truncate" title={book.title}>{book.title}</h1>
        </div>
      </div>

      {/* Navigation Mode */}
      <div className="flex p-2 gap-2 border-b border-gray-800">
        <button 
          onClick={() => onSelectView('editor')}
          className={`flex-1 flex items-center justify-center py-2 rounded text-xs font-medium transition-colors ${activeView === 'editor' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
        >
          <BookOpen className="w-3 h-3 mr-1" /> 写作
        </button>
        <button 
          onClick={() => onSelectView('wiki')}
          className={`flex-1 flex items-center justify-center py-2 rounded text-xs font-medium transition-colors ${activeView === 'wiki' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
        >
          <Database className="w-3 h-3 mr-1" /> 设定集
        </button>
      </div>

      {/* Content Tree */}
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {activeView === 'editor' ? (
          <div className="space-y-1">
            <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider flex justify-between items-center">
              <span>目录</span>
              <span className="text-[10px] bg-gray-800 px-1.5 py-0.5 rounded">{book.chapters.length}</span>
            </div>
            {book.chapters.map(chapter => (
              <button
                key={chapter.id}
                onClick={() => onSelectChapter(chapter.id)}
                className={`w-full text-left px-3 py-2 rounded flex items-center text-sm transition-colors group ${
                  activeChapterId === chapter.id 
                    ? 'bg-gray-800 text-white border-l-2 border-indigo-500' 
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                <FileText className={`w-4 h-4 mr-2 transition-opacity ${activeChapterId === chapter.id ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`} />
                <span className="truncate">{chapter.title || "未命名章节"}</span>
              </button>
            ))}
            <button 
              onClick={onCreateChapter}
              className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-indigo-400 flex items-center mt-2 border border-dashed border-gray-800 rounded hover:border-indigo-500/50 transition-all"
            >
              + 新建章节
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 space-y-4 px-4 text-center">
             <Database className="w-8 h-8 opacity-20" />
             <p className="text-xs">
               请在主视图管理<br/>世界观与角色卡片
             </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <button 
          onClick={onOpenSettings}
          className="flex items-center text-sm text-gray-400 hover:text-white transition-colors w-full"
        >
          <Settings className="w-4 h-4 mr-2" />
          全局设置
        </button>
      </div>
    </div>
  );
};

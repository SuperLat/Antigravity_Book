import React from 'react';
import { Book, FileText, BookOpen, Settings, Database, ChevronLeft, Trash2, User, Globe, BookMarked, ArrowDownAZ, ArrowUpAZ } from 'lucide-react';
import { Book as BookType, EntityType } from '../types';

interface SidebarProps {
  book: BookType;
  activeChapterId: string;
  onSelectChapter: (id: string) => void;
  onCreateChapter: () => void;
  onDeleteChapter: (id: string) => void;
  onDeleteChapters?: (ids: string[]) => void;
  onSortChapters?: (order: 'asc' | 'desc') => void;
  activeView: 'editor' | 'wiki';
  onSelectView: (view: 'editor' | 'wiki') => void;
  onBackToShelf: () => void;
  onOpenSettings: () => void;
  // New props for wiki type selection
  selectedEntityType?: EntityType;
  onSelectEntityType?: (type: EntityType) => void;
}

const ENTITY_TYPES = [
  { type: EntityType.CHARACTER, label: '角色', icon: User, color: 'text-blue-400' },
  { type: EntityType.WORLDVIEW, label: '世界观', icon: Globe, color: 'text-purple-400' },
  { type: EntityType.PLOT, label: '剧情', icon: BookMarked, color: 'text-green-400' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  book,
  activeChapterId,
  onSelectChapter,
  onCreateChapter,
  onDeleteChapter,
  onSortChapters,
  activeView,
  onSelectView,
  onBackToShelf,
  onOpenSettings,
  selectedEntityType = EntityType.CHARACTER,
  onSelectEntityType,
  onDeleteChapters
}) => {
  const [isBatchMode, setIsBatchMode] = React.useState(false);
  const [selectedChapterIds, setSelectedChapterIds] = React.useState<string[]>([]);

  const toggleBatchMode = () => {
    setIsBatchMode(!isBatchMode);
    setSelectedChapterIds([]);
  };

  const toggleSelectChapter = (id: string) => {
    setSelectedChapterIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedChapterIds.length === book.chapters.length) {
      setSelectedChapterIds([]);
    } else {
      setSelectedChapterIds(book.chapters.map(c => c.id));
    }
  };

  const handleBatchDelete = () => {
    if (selectedChapterIds.length === 0) return;
    if (window.confirm(`确定要删除选中的 ${selectedChapterIds.length} 个章节吗？`)) {
      onDeleteChapters?.(selectedChapterIds);
      setIsBatchMode(false);
      setSelectedChapterIds([]);
    }
  };
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
              <div className="flex items-center gap-2">
                <span>目录</span>
                <span className="text-[10px] bg-gray-800 px-1.5 py-0.5 rounded">{book.chapters.length}</span>
              </div>
              <div className="flex items-center gap-1">
                {onSortChapters && !isBatchMode && (
                  <>
                    <button
                      onClick={() => onSortChapters('asc')}
                      className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-indigo-400"
                      title="升序排列"
                    >
                      <ArrowDownAZ className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onSortChapters('desc')}
                      className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-indigo-400"
                      title="降序排列"
                    >
                      <ArrowUpAZ className="w-3 h-3" />
                    </button>
                  </>
                )}
                <button
                  onClick={toggleBatchMode}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${isBatchMode ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  {isBatchMode ? '取消' : '管理'}
                </button>
              </div>
            </div>
            {book.chapters.map((chapter, index) => (
              <div key={chapter.id} className="group relative">
                <button
                  onClick={() => isBatchMode ? toggleSelectChapter(chapter.id) : onSelectChapter(chapter.id)}
                  className={`w-full text-left px-3 py-2 rounded flex items-center text-sm transition-colors ${activeChapterId === chapter.id
                    ? 'bg-gray-800 text-white border-l-2 border-indigo-500'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    } ${isBatchMode && selectedChapterIds.includes(chapter.id) ? 'bg-indigo-900/20 ring-1 ring-indigo-500/30' : ''}`}
                >
                  {isBatchMode ? (
                    <div className={`w-4 h-4 mr-2 border rounded flex items-center justify-center transition-colors ${selectedChapterIds.includes(chapter.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-600'}`}>
                      {selectedChapterIds.includes(chapter.id) && <div className="w-2 h-2 bg-white rounded-sm" />}
                    </div>
                  ) : (
                    <FileText className={`w-4 h-4 mr-2 transition-opacity ${activeChapterId === chapter.id ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`} />
                  )}
                  <span className="truncate flex-1 pr-4">{chapter.title || "未命名章节"}</span>
                </button>

                {!isBatchMode && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-1 bg-gray-900/80 backdrop-blur-sm rounded px-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChapter(chapter.id);
                      }}
                      className="p-1 hover:bg-red-600/20 rounded text-gray-500 hover:text-red-400 transition-all"
                      title="删除章节"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            <button
              onClick={onCreateChapter}
              className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-indigo-400 flex items-center mt-2 border border-dashed border-gray-800 rounded hover:border-indigo-500/50 transition-all"
            >
              + 新建章节
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              分类
            </div>
            {ENTITY_TYPES.map(({ type, label, icon: Icon, color }) => {
              const count = book.entities.filter(e => e.type === type).length;
              return (
                <button
                  key={type}
                  onClick={() => onSelectEntityType?.(type)}
                  className={`w-full text-left px-3 py-2.5 rounded flex items-center text-sm transition-colors ${selectedEntityType === type
                    ? 'bg-gray-800 text-white border-l-2 border-indigo-500'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    }`}
                >
                  <Icon className={`w-4 h-4 mr-2 ${color}`} />
                  <span className="flex-1">{label}</span>
                  <span className="text-xs bg-gray-700/50 px-1.5 py-0.5 rounded text-gray-500">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Batch Actions Panel */}
      {isBatchMode && activeView === 'editor' && (
        <div className="p-3 bg-gray-800/50 border-t border-gray-800 flex items-center justify-between gap-2 animate-in slide-in-from-bottom-2 duration-200">
          <button
            onClick={handleSelectAll}
            className="text-[10px] text-gray-400 hover:text-white transition-colors"
          >
            {selectedChapterIds.length === book.chapters.length ? '取消全选' : '全选'}
          </button>
          <button
            onClick={handleBatchDelete}
            disabled={selectedChapterIds.length === 0}
            className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:bg-gray-700 text-white rounded text-xs font-bold transition-all flex items-center justify-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            删除选中 ({selectedChapterIds.length})
          </button>
        </div>
      )}

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


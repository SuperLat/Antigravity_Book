
import React, { useState, useRef } from 'react';
import { Book as BookType, EntityType, Entity, Chapter } from '../types';
import { Book, Plus, BookOpen, Download, Trash2, Archive, Loader2, Upload, MoreVertical, Edit, X } from 'lucide-react';
import JSZip from 'jszip';

interface BookshelfProps {
  books: BookType[];
  onSelectBook: (id: string) => void;
  onCreateBook: (book: Omit<BookType, 'id' | 'chapters' | 'entities'>) => void;
  onUpdateBook: (book: BookType) => void;
  onDeleteBook: (id: string) => void;
  onImportBook: (book: BookType) => void;
}

export const Bookshelf: React.FC<BookshelfProps> = ({ books, onSelectBook, onCreateBook, onUpdateBook, onDeleteBook, onImportBook }) => {
  const [showNewBookModal, setShowNewBookModal] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookDesc, setNewBookDesc] = useState('');

  // Edit State
  const [editingBook, setEditingBook] = useState<BookType | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [exportingId, setExportingId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleCreate = () => {
    if (!newBookTitle.trim()) return;
    onCreateBook({
      title: newBookTitle,
      author: 'User',
      description: newBookDesc,
      status: 'serializing',
      cover: 'from-indigo-500 to-purple-600'
    });
    setNewBookTitle('');
    setNewBookDesc('');
    setShowNewBookModal(false);
  };

  const handleUpdate = () => {
    if (!editingBook || !editTitle.trim()) return;
    onUpdateBook({
      ...editingBook,
      title: editTitle,
      description: editDesc
    });
    setEditingBook(null);
  };

  const openEditModal = (e: React.MouseEvent, book: BookType) => {
    e.stopPropagation();
    setEditingBook(book);
    setEditTitle(book.title);
    setEditDesc(book.description || '');
    setOpenMenuId(null);
  };

  // Helper to split content into chunks with serial numbers
  const addSplitContentToZip = (folder: JSZip | null, baseName: string, content: string) => {
    if (!folder) return;
    const MAX_CHARS = 5000; // Threshold for splitting

    if (content.length <= MAX_CHARS) {
      folder.file(`${baseName}.txt`, content);
    } else {
      let index = 0;
      let chunkCount = 1;
      while (index < content.length) {
        const chunk = content.slice(index, index + MAX_CHARS);
        const serial = chunkCount.toString().padStart(3, '0');
        folder.file(`${baseName}_${serial}.txt`, chunk);
        index += MAX_CHARS;
        chunkCount++;
      }
    }
  };

  const handleExport = async (e: React.MouseEvent, book: BookType) => {
    e.stopPropagation();
    if (exportingId) return;
    setExportingId(book.id);

    try {
      const zip = new JSZip();
      const root = zip.folder(book.title);

      if (!root) throw new Error("Could not create zip folder");

      // 1. Create Directories
      const folders = {
        outline: root.folder("大纲 (Outline)"),
        chars: root.folder("角色 (Characters)"),
        world: root.folder("世界观 (Worldview)"),
        content: root.folder("正文 (Content)")
      };

      // 2. Export Entities (Wiki)
      const outlines = book.entities.filter(e => e.type === EntityType.PLOT || e.type === EntityType.IDEA);
      const chars = book.entities.filter(e => e.type === EntityType.CHARACTER);
      const worlds = book.entities.filter(e => e.type === EntityType.WORLDVIEW);

      // Helper to format entity text
      const formatEntity = (e: any) => `【${e.name}】\n简介：${e.description}\n\n${e.content}\n`;

      // Batch export entities
      if (outlines.length > 0) {
        outlines.forEach(item => {
          addSplitContentToZip(folders.outline, item.name.replace(/[\\/:*?"<>|]/g, "_"), formatEntity(item));
        });
      }

      if (chars.length > 0) {
        chars.forEach(item => {
          addSplitContentToZip(folders.chars, item.name.replace(/[\\/:*?"<>|]/g, "_"), formatEntity(item));
        });
      }

      if (worlds.length > 0) {
        worlds.forEach(item => {
          addSplitContentToZip(folders.world, item.name.replace(/[\\/:*?"<>|]/g, "_"), formatEntity(item));
        });
      }

      // 3. Export Chapters (Content)
      book.chapters.forEach((chapter, index) => {
        const serial = (index + 1).toString().padStart(3, '0');
        const safeTitle = (chapter.title || "Untitled").replace(/[\\/:*?"<>|]/g, "_");
        const fileName = `${serial}_${safeTitle}`;
        const fileContent = `---SUMMARY---\n${chapter.summary || ''}\n---CONTENT---\n${chapter.content}`;
        addSplitContentToZip(folders.content, fileName, fileContent);
      });

      // 4. Generate and Download
      const blob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${book.title}_归档.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error) {
      console.error("Export failed", error);
      alert("导出失败，请重试");
    } finally {
      setExportingId(null);
    }
  };

  const processZipFile = async (file: File) => {
    setIsImporting(true);
    try {
      const zip = await JSZip.loadAsync(file);

      const newBook: BookType = {
        id: Date.now().toString(),
        title: file.name.replace('.zip', ''),
        author: 'Imported',
        description: '从本地归档导入',
        status: 'serializing',
        cover: 'from-gray-700 to-gray-600',
        chapters: [],
        entities: []
      };

      // Helper for merging split files
      // Structure: Key = BaseName, Value = { chunks: Map<index, content>, type, ... }
      interface FileGroup {
        name: string;
        type: 'chapter' | 'entity';
        entityType?: EntityType;
        order?: number; // for chapters
        chunks: { id: number, content: string }[];
      }

      const groups = new Map<string, FileGroup>();

      // 1. Iterate files to group chunks
      for (const relativePath of Object.keys(zip.files)) {
        const fileEntry = zip.files[relativePath];
        if (fileEntry.dir) continue;
        if (relativePath.includes('__MACOSX') || relativePath.includes('.DS_Store')) continue;

        const parts = relativePath.split('/');
        const fileName = parts[parts.length - 1];
        const folderName = parts.length > 1 ? parts[parts.length - 2] : '';

        // Determine Type
        let type: 'chapter' | 'entity' | null = null;
        let entityType: EntityType | undefined;

        if (folderName.includes('正文')) {
          type = 'chapter';
        } else if (folderName.includes('角色')) {
          type = 'entity';
          entityType = EntityType.CHARACTER;
        } else if (folderName.includes('世界观')) {
          type = 'entity';
          entityType = EntityType.WORLDVIEW;
        } else if (folderName.includes('大纲')) {
          type = 'entity';
          entityType = EntityType.PLOT;
        }

        if (!type) continue;

        const content = await fileEntry.async("string");

        // Parse Filename for Splitting
        // Logic: 
        // Chapter: 001_Title.txt OR 001_Title_001.txt
        // Entity: Name.txt OR Name_001.txt

        let baseKey = fileName;
        let chunkId = 0;

        // Try to match split pattern _001.txt at end
        const splitMatch = fileName.match(/^(.*)_(\d{3})\.txt$/);
        if (splitMatch) {
          // It might be a split file. 
          // BUT: "001_Chapter" matches this if regex is greedy? No, \d{3} is specific.
          // "001_Title_001.txt" -> Base: "001_Title", Chunk: 1
          baseKey = splitMatch[1];
          chunkId = parseInt(splitMatch[2]);
        } else {
          baseKey = fileName.replace('.txt', '');
        }

        if (!groups.has(baseKey)) {
          groups.set(baseKey, {
            name: baseKey,
            type,
            entityType,
            chunks: []
          });
        }
        groups.get(baseKey)?.chunks.push({ id: chunkId, content });
      }

      // 2. Process Groups into Objects
      const chapters: Chapter[] = [];
      const entities: Entity[] = [];

      for (const group of groups.values()) {
        // Merge content
        group.chunks.sort((a, b) => a.id - b.id);
        const fullContent = group.chunks.map(c => c.content).join('');

        if (group.type === 'chapter') {
          // Parse Order and Title from BaseKey: "001_Title"
          const match = group.name.match(/^(\d{3})_(.*)$/);
          const order = match ? parseInt(match[1]) : 999;
          const title = match ? match[2].replace(/_/g, ' ') : group.name;
          
          let summary = '';
          let content = fullContent;
          
          const summaryMatch = fullContent.match(/^---SUMMARY---\n([\s\S]*?)\n---CONTENT---\n/);

          if (summaryMatch) {
            summary = summaryMatch[1].trim();
            content = fullContent.substring(summaryMatch[0].length);
          }


          chapters.push({
            id: Date.now().toString() + Math.random(),
            title: title,
            content: content,
            summary: summary
          });
          // Store order temp for sorting
          (chapters[chapters.length - 1] as any)._order = order;

        } else if (group.type === 'entity' && group.entityType) {
          // Parse Content to extract Name/Desc if possible
          // Format: 【Name】\n简介：Desc\n\nContent
          const match = fullContent.match(/^【(.*?)】\n简介：(.*?)\n\n([\s\S]*)$/);

          let entityName = group.name.replace(/_/g, ' ');
          let desc = '导入的条目';
          let realContent = fullContent;

          if (match) {
            entityName = match[1];
            desc = match[2];
            realContent = match[3];
          }

          entities.push({
            id: Date.now().toString() + Math.random(),
            type: group.entityType,
            name: entityName,
            description: desc,
            tags: ['导入'],
            content: realContent
          });
        }
      }

      // 3. Finalize Book
      // Sort chapters by order
      chapters.sort((a, b) => ((a as any)._order || 0) - ((b as any)._order || 0));

      newBook.chapters = chapters;
      newBook.entities = entities;

      if (chapters.length === 0) {
        newBook.chapters.push({ id: Date.now().toString(), title: '第一章', content: '' });
      }

      onImportBook(newBook);

    } catch (e) {
      console.error(e);
      alert("导入失败：文件格式不正确或已损坏");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex-1 bg-gray-950 p-8 overflow-y-auto h-full">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 flex justify-between items-end border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-serif font-bold text-gray-100 mb-2">我的书架</h1>
            <p className="text-gray-500 text-sm">管理你的小说创作项目</p>
          </div>
          <div className="flex gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && processZipFile(e.target.files[0])}
              accept=".zip"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md transition-colors border border-gray-700"
            >
              {isImporting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Upload className="w-5 h-5 mr-2" />}
              导入
            </button>
            <button
              onClick={() => setShowNewBookModal(true)}
              className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" /> 新建作品
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {books.map(book => (
            <div
              key={book.id}
              onClick={() => onSelectBook(book.id)}
              className="group relative bg-gray-900 border border-gray-800 rounded-lg overflow-hidden hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all cursor-pointer flex flex-col h-72"
            >
              {/* Cover Area */}
              <div className={`h-32 bg-gradient-to-br ${book.cover || 'from-gray-700 to-gray-800'} p-4 relative`}>
                <div className={`absolute top-2 right-2 flex gap-2 transition-opacity ${openMenuId === book.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {/* More Menu */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === book.id ? null : book.id);
                      }}
                      className={`p-1.5 rounded-full text-white backdrop-blur-sm transition-colors ${openMenuId === book.id ? 'bg-indigo-600' : 'bg-black/50 hover:bg-gray-600'}`}
                      title="更多选项"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {openMenuId === book.id && (
                      <div className="absolute right-0 top-8 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 w-36 py-1 overflow-hidden">
                        <button
                          onClick={(e) => openEditModal(e, book)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center"
                        >
                          <Edit className="w-4 h-4 mr-2" /> 编辑信息
                        </button>
                        <button
                          onClick={(e) => {
                            handleExport(e, book);
                            setOpenMenuId(null);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center"
                        >
                          {exportingId === book.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Archive className="w-4 h-4 mr-2" />}
                          导出归档
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteBook(book.id);
                            setOpenMenuId(null);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 flex items-center"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> 删除作品
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <Book className="w-8 h-8 text-white/20 absolute bottom-4 right-4" />
              </div>

              {/* Content Area */}
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-gray-100 line-clamp-1 group-hover:text-indigo-400 transition-colors">
                    {book.title}
                  </h3>
                </div>
                <p className="text-gray-500 text-xs mb-4 line-clamp-2 flex-1">
                  {book.description || "暂无简介..."}
                </p>

                <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-4 border-t border-gray-800/50">
                  <span className="flex items-center">
                    <BookOpen className="w-3 h-3 mr-1" />
                    {book.chapters.length} 章
                  </span>
                  <span className={`px-2 py-0.5 rounded-full ${book.status === 'serializing' ? 'bg-green-900/30 text-green-400' : 'bg-blue-900/30 text-blue-400'}`}>
                    {book.status === 'serializing' ? '连载中' : '已完结'}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* New Book Placeholder */}
          {books.length === 0 && (
            <div
              onClick={() => setShowNewBookModal(true)}
              className="border-2 border-dashed border-gray-800 rounded-lg flex flex-col items-center justify-center text-gray-600 hover:text-gray-400 hover:border-gray-700 hover:bg-gray-900/50 transition-all cursor-pointer h-72"
            >
              <Plus className="w-12 h-12 mb-4 opacity-50" />
              <span className="font-medium">创建第一部作品</span>
            </div>
          )}
        </div>
      </div>

      {/* New Book Modal */}
      {showNewBookModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">新建作品</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">书名</label>
                <input
                  type="text"
                  value={newBookTitle}
                  onChange={e => setNewBookTitle(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="请输入小说标题"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">简介</label>
                <textarea
                  value={newBookDesc}
                  onChange={e => setNewBookDesc(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none h-32 resize-none"
                  placeholder="简单描述你的故事梗概..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-8">
              <button
                onClick={() => setShowNewBookModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!newBookTitle.trim()}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Book Modal */}
      {editingBook && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">编辑作品信息</h2>
              <button onClick={() => setEditingBook(null)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">书名</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="请输入小说标题"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">简介</label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none h-32 resize-none"
                  placeholder="简单描述你的故事梗概..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-8">
              <button
                onClick={() => setEditingBook(null)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleUpdate}
                disabled={!editTitle.trim()}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { ContextPanel } from './components/ContextPanel';
import { WikiView } from './components/WikiView';
import { Bookshelf } from './components/Bookshelf';
import { IdeaLab } from './components/IdeaLab';
import { PromptManager } from './components/PromptManager';
import { SettingsModal } from './components/SettingsModal';
import { generateNovelContent, generateWorldviewFromIdea } from './services/geminiService';
import { Book, Chapter, Entity, EntityType, ChatMessage, AppSettings, IdeaProject, PromptTemplate } from './types';
import { Library, Lightbulb, Settings, Terminal, Minimize2 } from 'lucide-react';

// --- MOCK DATA ---
const MOCK_ENTITIES_BOOK1: Entity[] = [
  {
    id: '1',
    type: EntityType.CHARACTER,
    name: '林渊',
    description: '一名拥有机械义肢的落魄剑修。',
    tags: ['主角', '剑修', '赛博朋克'],
    content: '年龄：24岁。外貌：凌乱的黑发，左眼植入蓝色义眼，右臂是生锈的机械义肢，背负一把断剑。性格：愤世嫉俗但内心正义，为了寻找失踪的妹妹而来到下城区。特长：能够用黑客技术破解阵法。'
  },
  {
    id: '2',
    type: EntityType.WORLDVIEW,
    name: '霓虹天阙',
    description: '一座通过抽取地脉灵气运作的超级巨塔城市。',
    tags: ['地点', '设定'],
    content: '天阙直插云霄，将世界分为上城与下城。上城是修真财阀的乐园，灵气充裕；下城终年不见天日，充满了酸雨和辐射，人们通过劣质的义体和非法丹药苟延残喘。'
  },
  {
    id: '3',
    type: EntityType.CHARACTER,
    name: '瑶光',
    description: '诞生于网络数据海中的AI灵体。',
    tags: ['配角', 'AI'],
    content: '形象：只有巴掌大的全息投影少女。能力：可以瞬间入侵任何未加密的灵能终端，是林渊的情报来源。'
  }
];

const INITIAL_BOOKS: Book[] = [
  {
    id: 'book1',
    title: '天阙残响',
    author: 'User',
    description: '赛博朋克与古典修真的碰撞。当飞剑遇上电磁炮，当元婴大能被上传至云端...',
    status: 'serializing',
    cover: 'from-indigo-600 to-blue-600',
    entities: MOCK_ENTITIES_BOOK1,
    chapters: [
      { id: 'c1', title: '第一章：雨夜断剑', content: "雨水带着酸涩的铁锈味，顺着林渊的脸颊滑落，渗进他那只生锈的机械臂接口里，带来一阵轻微的刺痛。\n\n他拉紧了破旧的风衣领口，抬头望向头顶。那座名为“霓虹天阙”的巨塔宛如一把利剑，刺破了下城终年不散的阴霾。塔顶的灵能霓虹灯光怪陆离，那是上城修真者们醉生梦死的证明，而在这下城的暗巷里，只有腐烂的垃圾和绝望的喘息。\n\n林渊检查了一下义眼的读数，灵力储备仅剩 12%。这点灵力连启动一次御剑术都够呛，但在这种鬼地方点一支烟倒是足够了。\n\n“喂，林渊，检测到三个高能反应正在靠近。”耳边传来了瑶光略带焦急的电子音。\n\n" },
    ]
  }
];

// Default Prompts
const DEFAULT_PROMPTS: PromptTemplate[] = [
  { id: 'describe', name: '场景描写', description: '基于当前设定描写环境', category: 'drafting', isBuiltIn: true, template: '结合当前世界观设定，详细描写当前场景的环境，注重氛围感和五感体验，字数300字左右。' },
  { id: 'dialogue', name: '对话润色', description: '优化人物对白', category: 'refining', isBuiltIn: true, template: '请润色上述对话，使其听起来更自然，并更符合角色的性格特征，增加必要的动作描写和潜台词。' },
  { id: 'action', name: '战斗/动作', description: '描写激烈的打斗', category: 'drafting', isBuiltIn: true, template: '描写一段紧张激烈的动作/战斗场面，注重动作细节、打击感和画面感，融合世界观中的力量体系。' },
  { id: 'expand', name: '情节扩写', description: '从摘要扩写为正文', category: 'brainstorm', isBuiltIn: true, template: '根据这段简短的摘要，扩写成一个细节丰富的完整场景，保持叙事流畅。' },
  { id: 'char_design', name: '反派生成', description: '生成反派人设', category: 'character', isBuiltIn: true, template: '请设计一个反派角色。要求：与主角有利益冲突，外表绅士但内心冷酷。请生成：姓名、外貌描写、性格关键词、能力缺点。' },
  { id: 'world_build', name: '世界观构建', description: '根据核心梗生成世界', category: 'world', isBuiltIn: true, template: '核心梗：{{spark}}\n\n请设计一个详细的世界观。包含：\n1. 力量体系\n2. 社会结构\n3. 核心矛盾\n4. 地理风貌\n' },
  { id: 'outline_gen', name: '三幕式大纲', description: '生成标准大纲', category: 'outline', isBuiltIn: true, template: '基于已有的世界观和核心梗，请规划一个标准的三幕式小说大纲，包含起因、发展、高潮和结尾。世界观：{{worldview}}' },
  { id: 'beat_split', name: '章节拆分', description: '细化为章节细纲', category: 'beats', isBuiltIn: true, template: '请将上述大纲的第一部分拆分为5-10个具体的章节，每个章节包含标题、核心事件和出场人物。大纲：{{outline}}' },
];

const DEFAULT_SETTINGS: AppSettings = {
  ai: {
    provider: 'gemini',
    apiKey: '',
    modelName: 'gemini-2.5-flash',
    temperature: 0.8,
    maxTokens: 2048,
    contextWindow: 2000
  },
  appearance: {
    theme: 'dark',
    fontSize: 'medium',
    immersiveMode: false
  }
};

// Helper for lazy loading
const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (e) {
    console.error(`Failed to load ${key}`, e);
    return defaultValue;
  }
};

const App: React.FC = () => {
  // Global State with Lazy Initialization
  const [books, setBooks] = useState<Book[]>(() => loadFromStorage('novelcraft_books', INITIAL_BOOKS));
  const [ideas, setIdeas] = useState<IdeaProject[]>(() => loadFromStorage('novelcraft_ideas', []));
  const [prompts, setPrompts] = useState<PromptTemplate[]>(() => loadFromStorage('novelcraft_prompts', DEFAULT_PROMPTS));
  const [settings, setSettings] = useState<AppSettings>(() => loadFromStorage('novelcraft_settings', DEFAULT_SETTINGS));

  const [activeBookId, setActiveBookId] = useState<string | null>(null);

  // Dashboard Navigation State
  const [dashboardTab, setDashboardTab] = useState<'bookshelf' | 'idealab' | 'prompt_manager'>('bookshelf');

  const [showSettings, setShowSettings] = useState(false);

  // --- Persistence Effects ---
  useEffect(() => {
    localStorage.setItem('novelcraft_books', JSON.stringify(books));
  }, [books]);

  useEffect(() => {
    localStorage.setItem('novelcraft_ideas', JSON.stringify(ideas));
  }, [ideas]);

  useEffect(() => {
    localStorage.setItem('novelcraft_prompts', JSON.stringify(prompts));
  }, [prompts]);

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('novelcraft_settings', JSON.stringify(newSettings));
  };

  // Active Book State
  const [activeChapterId, setActiveChapterId] = useState<string>('');
  const [activeView, setActiveView] = useState<'editor' | 'wiki'>('editor');
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);

  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Derived
  const activeBook = books.find(b => b.id === activeBookId);
  const activeChapter = activeBook?.chapters.find(c => c.id === activeChapterId) || activeBook?.chapters[0];

  // --- Handlers: Books ---
  const handleSelectBook = (id: string) => {
    setActiveBookId(id);
    const book = books.find(b => b.id === id);
    if (book && book.chapters.length > 0) setActiveChapterId(book.chapters[0].id);
    setActiveView('editor');
    setChatHistory([]);
    setSelectedEntityIds([]);
    setSelectedChapterIds([]);
  };

  const handleCreateBook = (newBookData: Omit<Book, 'id' | 'chapters' | 'entities'>) => {
    const newBook: Book = {
      ...newBookData,
      id: Date.now().toString(),
      chapters: [{ id: Date.now().toString() + '_c', title: '第一章', content: '' }],
      entities: []
    };
    setBooks(prev => [...prev, newBook]);
  };

  const handleDeleteBook = (id: string) => {
    if (window.confirm('确定要删除这本书吗？')) setBooks(prev => prev.filter(b => b.id !== id));
  };

  const handleImportBook = (book: Book) => {
    setBooks(prev => [...prev, book]);
    alert(`成功导入作品：《${book.title}》`);
  };

  // --- Handlers: Ideas ---
  const handleCreateIdea = () => {
    const newIdea: IdeaProject = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      title: '新灵感项目',
      spark: '',
      worldview: '',
      outline: '',
      chapterBeats: [],
      updatedAt: Date.now()
    };
    setIdeas(prev => [newIdea, ...prev]);
  };

  const handleUpdateIdea = (id: string, updates: Partial<IdeaProject>) => {
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, ...updates, updatedAt: Date.now() } : i));
  };

  const handleDeleteIdea = (id: string) => {
    if (window.confirm('确定删除此灵感项目吗？')) setIdeas(prev => prev.filter(i => i.id !== id));
  };

  const handleConvertIdeaToBook = (idea: IdeaProject) => {
    const newBook: Book = {
      id: Date.now().toString(),
      title: idea.title,
      author: 'User',
      description: idea.spark,
      status: 'serializing',
      cover: 'from-yellow-600 to-orange-600',
      entities: [
        {
          id: Date.now() + '_w',
          type: EntityType.WORLDVIEW,
          name: '世界观设定',
          description: '基于灵感实验室生成',
          tags: ['核心设定'],
          content: idea.worldview
        },
        {
          id: Date.now() + '_p',
          type: EntityType.PLOT,
          name: '全书大纲',
          description: '三幕式结构',
          tags: ['大纲'],
          content: idea.outline
        }
      ],
      chapters: idea.chapterBeats.length > 0
        ? idea.chapterBeats.map((beat, idx) => ({
          id: Date.now() + `_c${idx}`,
          title: beat.chapterTitle,
          summary: beat.summary,
          content: `【本章摘要】\n${beat.summary}\n\n【核心冲突】\n${beat.conflict}\n\n【出场人物】\n${beat.keyCharacters.join(', ')}\n\n(在此开始写作...)`
        }))
        : [{ id: Date.now() + '_c', title: '第一章', content: '' }]
    };

    setBooks(prev => [...prev, newBook]);
    alert(`成功将《${idea.title}》转化为书籍！已添加到书架。`);
    setDashboardTab('bookshelf');
  };

  // --- Handlers: Prompts ---
  const handleAddPrompt = (prompt: PromptTemplate) => {
    setPrompts(prev => [...prev, prompt]);
  };

  const handleUpdatePrompt = (updatedPrompt: PromptTemplate) => {
    setPrompts(prev => prev.map(p => p.id === updatedPrompt.id ? updatedPrompt : p));
  };

  const handleDeletePrompt = (id: string) => {
    if (window.confirm('确定删除此指令吗？')) {
      // Functional update to ensure we are filtering the latest state
      setPrompts(prev => prev.filter(p => p.id !== id));
    }
  };

  // --- Handlers: Content ---
  const updateActiveBook = (updater: (book: Book) => Book) => {
    if (!activeBookId) return;
    setBooks(prev => prev.map(b => b.id === activeBookId ? updater(b) : b));
  };

  const handleUpdateChapterContent = (content: string) => {
    updateActiveBook(book => ({
      ...book,
      chapters: book.chapters.map(c => c.id === activeChapterId ? { ...c, content } : c)
    }));
  };

  const handleUpdateChapterTitle = (title: string) => {
    updateActiveBook(book => ({
      ...book,
      chapters: book.chapters.map(c => c.id === activeChapterId ? { ...c, title } : c)
    }));
  };

  const handleCreateChapter = () => {
    const newChapter: Chapter = { id: Date.now().toString(), title: '新章节', content: '' };
    updateActiveBook(book => ({ ...book, chapters: [...book.chapters, newChapter] }));
    setActiveChapterId(newChapter.id);
  };

  const handleAddEntity = (entity: Entity) => updateActiveBook(b => ({ ...b, entities: [...b.entities, entity] }));
  const handleUpdateEntity = (entity: Entity) => updateActiveBook(b => ({ ...b, entities: b.entities.map(e => e.id === entity.id ? entity : e) }));
  const handleDeleteEntity = (id: string) => updateActiveBook(b => ({ ...b, entities: b.entities.filter(e => e.id !== id) }));

  // --- AI Handlers ---
  const handleGenerate = async (prompt: string) => {
    if (isGenerating || !activeBook || !activeChapter) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: prompt, timestamp: Date.now() };
    setChatHistory(prev => [...prev, userMsg]);
    setIsGenerating(true);

    try {
      const selectedEntities = activeBook.entities.filter(e => selectedEntityIds.includes(e.id));
      const selectedChapters = activeBook.chapters.filter(c => selectedChapterIds.includes(c.id));
      const responseText = await generateNovelContent({
        aiConfig: settings.ai,
        userPrompt: prompt,
        selectedEntities,
        selectedChapters,
        activeChapter,
        previousChapterSummary: "（暂无前情提要）"
      });
      const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: responseText, timestamp: Date.now() };
      setChatHistory(prev => [...prev, aiMsg]);
    } catch (error) {
      setChatHistory(prev => [...prev, { id: Date.now().toString(), role: 'model', text: `错误: ${(error as Error).message}`, timestamp: Date.now() }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateWorldview = async (idea: Entity) => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const result = await generateWorldviewFromIdea(settings.ai, idea.content);
      const newWorldview: Entity = {
        id: Date.now().toString(),
        type: EntityType.WORLDVIEW,
        name: `基于“${idea.name}”的世界观`,
        description: '由AI自动生成的详细世界观设定',
        tags: ['AI生成', '世界观'],
        content: result
      };
      handleAddEntity(newWorldview);
      alert('世界观生成成功！已保存到设定集。');
    } catch (error) {
      alert(`生成失败: ${(error as Error).message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // --- View Selection ---

  // 1. Workspace View (Inside a Book)
  if (activeBookId && activeBook) {
    return (
      <div className="flex h-screen bg-gray-950 text-gray-100 font-sans relative">
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          settings={settings}
          onSave={handleSaveSettings}
        />
        {!settings.appearance.immersiveMode && (
          <Sidebar
            book={activeBook}
            activeChapterId={activeChapterId}
            onSelectChapter={setActiveChapterId}
            onCreateChapter={handleCreateChapter}
            activeView={activeView}
            onSelectView={setActiveView}
            onBackToShelf={() => setActiveBookId(null)}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}
        <main className="flex-1 flex overflow-hidden relative">
          {settings.appearance.immersiveMode && (
            <button onClick={() => handleSaveSettings({ ...settings, appearance: { ...settings.appearance, immersiveMode: false } })} className="absolute top-4 right-8 z-50 bg-gray-900/50 p-2 rounded-full backdrop-blur-sm hover:text-indigo-400">
              <Minimize2 className="w-5 h-5" />
            </button>
          )}
          {activeView === 'editor' && activeChapter ? (
            <>
              <Editor
                chapter={activeChapter}
                onChange={handleUpdateChapterContent}
                onTitleChange={handleUpdateChapterTitle}
                fontSize={settings.appearance.fontSize}
              />
              {!settings.appearance.immersiveMode && (
                <ContextPanel
                  entities={activeBook.entities}
                  selectedEntityIds={selectedEntityIds}
                  onToggleEntity={(id) => setSelectedEntityIds(p => p.includes(id) ? p.filter(e => e !== id) : [...p, id])}
                  chapters={activeBook.chapters}
                  activeChapterId={activeChapterId}
                  selectedChapterIds={selectedChapterIds}
                  onToggleChapter={(id) => setSelectedChapterIds(p => p.includes(id) ? p.filter(c => c !== id) : [...p, id])}
                  onGenerate={handleGenerate}
                  isGenerating={isGenerating}
                  chatHistory={chatHistory}
                  prompts={prompts}
                />
              )}
            </>
          ) : (
            <WikiView
              entities={activeBook.entities}
              onAddEntity={handleAddEntity}
              onUpdateEntity={handleUpdateEntity}
              onDeleteEntity={handleDeleteEntity}
              onGenerateWorldview={handleGenerateWorldview}
              isGenerating={isGenerating}
            />
          )}
        </main>
      </div>
    );
  }

  // 2. Dashboard View (Bookshelf or Idea Lab)
  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans">
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      {/* Activity Bar (Leftmost Slim Navigation) */}
      <div className="w-16 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-6 shrink-0 z-20">
        <div className="mb-8">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold font-serif text-white">N</div>
        </div>

        <button
          onClick={() => setDashboardTab('bookshelf')}
          className={`p-3 rounded-lg mb-4 transition-all ${dashboardTab === 'bookshelf' ? 'bg-indigo-600/20 text-indigo-400' : 'text-gray-500 hover:text-gray-300'}`}
          title="我的书架"
        >
          <Library className="w-6 h-6" />
        </button>

        <button
          onClick={() => setDashboardTab('idealab')}
          className={`p-3 rounded-lg mb-4 transition-all ${dashboardTab === 'idealab' ? 'bg-yellow-600/20 text-yellow-400' : 'text-gray-500 hover:text-gray-300'}`}
          title="灵感实验室"
        >
          <Lightbulb className="w-6 h-6" />
        </button>

        <button
          onClick={() => setDashboardTab('prompt_manager')}
          className={`p-3 rounded-lg mb-4 transition-all ${dashboardTab === 'prompt_manager' ? 'bg-green-600/20 text-green-400' : 'text-gray-500 hover:text-gray-300'}`}
          title="提示词工程"
        >
          <Terminal className="w-6 h-6" />
        </button>

        <div className="mt-auto flex flex-col items-center gap-4">
          <button onClick={() => setShowSettings(true)} className="p-2 text-gray-500 hover:text-white transition-colors" title="全局设置">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="flex-1 overflow-hidden bg-gray-950 relative">
        {dashboardTab === 'bookshelf' && (
          <Bookshelf
            books={books}
            onSelectBook={handleSelectBook}
            onCreateBook={handleCreateBook}
            onDeleteBook={handleDeleteBook}
            onImportBook={handleImportBook}
          />
        )}
        {dashboardTab === 'idealab' && (
          <IdeaLab
            ideas={ideas}
            settings={settings}
            prompts={prompts}
            onCreateIdea={handleCreateIdea}
            onUpdateIdea={handleUpdateIdea}
            onDeleteIdea={handleDeleteIdea}
            onConvertToBook={handleConvertIdeaToBook}
          />
        )}
        {dashboardTab === 'prompt_manager' && (
          <PromptManager
            prompts={prompts}
            onAddPrompt={handleAddPrompt}
            onUpdatePrompt={handleUpdatePrompt}
            onDeletePrompt={handleDeletePrompt}
          />
        )}
      </div>
    </div>
  );
};

export default App;
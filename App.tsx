import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { ContextPanel } from './components/ContextPanel';
import { WikiView } from './components/WikiView';
import { Bookshelf } from './components/Bookshelf';
import { IdeaLab } from './components/IdeaLab';
import { PromptManager } from './components/PromptManager';
import { SettingsModal } from './components/SettingsModal';
import { ChapterSummaryModal } from './components/ChapterSummaryModal';
import { AuthPage } from './components/AuthPage';
import { UserProfileModal } from './components/UserProfileModal';
import { AILogViewer } from './components/AILogViewer';
import { EditorToolbar } from './components/EditorToolbar';
import { AIAssistantModal } from './components/AIAssistantModal';
import { generateNovelContent, generateWorldviewFromIdea, generateChapterSummary } from './services/geminiService';
import { booksAPI, promptsAPI, ideasAPI, settingsAPI, authAPI, aiLogsAPI } from './services/api';
import { Book, Chapter, Entity, EntityType, ChatMessage, AppSettings, IdeaProject, PromptTemplate, ModelConfig } from './types';
import { ChapterLink } from './components/ChapterLinkModal';
import { Library, Lightbulb, Settings, Terminal, Minimize2, Loader2, User, History } from 'lucide-react';

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
  models: [{
    id: 'default',
    name: '默认模型',
    provider: 'gemini',
    apiKey: '',
    modelName: 'gemini-2.5-flash',
    temperature: 0.8,
    maxTokens: 2048,
    contextWindow: 2000
  }],
  defaultModelId: 'default',
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

// Migration helper: Convert old AIConfig to new ModelConfig array
const migrateSettings = (settings: AppSettings): AppSettings => {
  // If already migrated, return as-is
  if (settings.models && settings.defaultModelId) {
    return settings;
  }

  // If old format exists, migrate it
  if (settings.ai) {
    const defaultModel: ModelConfig = {
      id: 'default',
      name: '默认模型',
      provider: settings.ai.provider,
      apiKey: settings.ai.apiKey,
      baseUrl: settings.ai.baseUrl,
      modelName: settings.ai.modelName,
      temperature: settings.ai.temperature,
      maxTokens: settings.ai.maxTokens,
      contextWindow: settings.ai.contextWindow,
    };

    return {
      ...settings,
      models: [defaultModel],
      defaultModelId: 'default',
      ai: undefined, // Remove legacy field
    };
  }

  // No settings exist, return default
  return settings;
};

const App: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Global State - Initially empty, loaded from API
  const [books, setBooks] = useState<Book[]>([]);
  const [ideas, setIdeas] = useState<IdeaProject[]>([]);
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const [activeBookId, setActiveBookId] = useState<string | null>(null);

  // Dashboard Navigation State
  const [dashboardTab, setDashboardTab] = useState<'bookshelf' | 'idealab' | 'prompt_manager'>('bookshelf');
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAILogs, setShowAILogs] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setShowProfile(false);
    // Reset state
    setBooks([]);
    setIdeas([]);
    setPrompts([]);
    setActiveBookId(null);
  };

  // --- Check Auth on Mount ---
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsAuthenticated(false);
        setIsAuthChecking(false);
        return;
      }

      try {
        await authAPI.getCurrentUser();
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
        setIsAuthenticated(false);
      } finally {
        setIsAuthChecking(false);
      }
    };

    checkAuth();
  }, []);

  // --- Load Data from API on Mount (Only if Authenticated) ---
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadData = async () => {
      try {
        setIsLoading(true);

        // Load all data in parallel
        const [booksData, ideasData, promptsData, settingsData] = await Promise.all([
          booksAPI.getAll().catch(() => loadFromStorage('novelcraft_books', INITIAL_BOOKS)),
          ideasAPI.getAll().catch(() => loadFromStorage('novelcraft_ideas', [])),
          promptsAPI.getAll().catch(() => loadFromStorage('novelcraft_prompts', DEFAULT_PROMPTS)),
          settingsAPI.get().catch(() => {
            const loaded = loadFromStorage('novelcraft_settings', DEFAULT_SETTINGS);
            return migrateSettings(loaded);
          })
        ]);

        setBooks(booksData.length > 0 ? booksData : INITIAL_BOOKS);
        setIdeas(ideasData);
        setPrompts(promptsData.length > 0 ? promptsData : DEFAULT_PROMPTS);
        setSettings(settingsData ? migrateSettings(settingsData) : DEFAULT_SETTINGS);
      } catch (error) {
        console.error('Failed to load data:', error);
        // Fallback to LocalStorage
        setBooks(loadFromStorage('novelcraft_books', INITIAL_BOOKS));
        setIdeas(loadFromStorage('novelcraft_ideas', []));
        setPrompts(loadFromStorage('novelcraft_prompts', DEFAULT_PROMPTS));
        const loaded = loadFromStorage('novelcraft_settings', DEFAULT_SETTINGS);
        setSettings(migrateSettings(loaded));
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isAuthenticated]);

  // --- Debounced Save to API ---
  useEffect(() => {
    if (isLoading) return; // Don't save during initial load

    const saveBooks = async () => {
      try {
        await Promise.all(books.map(book => booksAPI.save(book)));
        // Also save to localStorage as backup
        localStorage.setItem('novelcraft_books', JSON.stringify(books));
      } catch (error) {
        console.error('Failed to save books:', error);
      }
    };

    const timer = setTimeout(saveBooks, 1000); // Debounce 1 second
    return () => clearTimeout(timer);
  }, [books, isLoading]);

  useEffect(() => {
    if (isLoading) return;

    const saveIdeas = async () => {
      try {
        await Promise.all(ideas.map(idea => ideasAPI.save(idea)));
        localStorage.setItem('novelcraft_ideas', JSON.stringify(ideas));
      } catch (error) {
        console.error('Failed to save ideas:', error);
      }
    };

    const timer = setTimeout(saveIdeas, 1000);
    return () => clearTimeout(timer);
  }, [ideas, isLoading]);

  useEffect(() => {
    if (isLoading) return;

    const savePrompts = async () => {
      try {
        await Promise.all(prompts.map(prompt => promptsAPI.save(prompt)));
        localStorage.setItem('novelcraft_prompts', JSON.stringify(prompts));
      } catch (error) {
        console.error('Failed to save prompts:', error);
      }
    };

    const timer = setTimeout(savePrompts, 1000);
    return () => clearTimeout(timer);
  }, [prompts, isLoading]);

  const handleSaveSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      await settingsAPI.save(newSettings);
      localStorage.setItem('novelcraft_settings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save settings:', error);
      // Fallback to localStorage only
      localStorage.setItem('novelcraft_settings', JSON.stringify(newSettings));
    }
  };

  // Active Book State
  const [activeChapterId, setActiveChapterId] = useState<string>('');
  const [activeView, setActiveView] = useState<'editor' | 'wiki'>('editor');
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [chapterLinks, setChapterLinks] = useState<ChapterLink[]>([]);
  const [selectedEntityType, setSelectedEntityType] = useState<EntityType>(EntityType.CHARACTER);

  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Summary Modal State
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // Derived
  const activeBook = books.find(b => b.id === activeBookId);
  const activeChapter = activeBook?.chapters.find(c => c.id === activeChapterId) || activeBook?.chapters[0];

  // --- Handlers: Books ---
  const handleSelectBook = (id: string) => {
    setActiveBookId(id);
    const book = books.find(b => b.id === id);
    if (book && book.chapters.length > 0) {
      setActiveChapterId(book.chapters[0].id);
    }
    setActiveView('editor');
    setChatHistory([]);
    setSelectedEntityIds([]);
    setChapterLinks([]);
  };

  const handleCreateBook = (newBookData: Omit<Book, 'id' | 'chapters' | 'entities'>) => {
    const newBook: Book = {
      ...newBookData,
      id: Date.now().toString(),
      chapters: [{ id: Date.now().toString() + '_c', title: '第一章', content: '' }],
      entities: []
    };
    setBooks(prev => [...prev, newBook]);
    booksAPI.save(newBook).catch(err => console.error("Failed to create book", err));
  };

  const handleUpdateBook = (updatedBook: Book) => {
    setBooks(prev => prev.map(b => b.id === updatedBook.id ? updatedBook : b));
    booksAPI.save(updatedBook).catch(err => console.error("Failed to save book update", err));
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

  const handleDeleteChapter = (id: string) => {
    if (!activeBook) return;
    if (activeBook.chapters.length <= 1) {
      alert('至少需要保留一个章节');
      return;
    }
    if (window.confirm('确定要删除这个章节吗？')) {
      updateActiveBook(book => {
        const newChapters = book.chapters.filter(c => c.id !== id);
        return { ...book, chapters: newChapters };
      });
      // If deleting active chapter, switch to first chapter
      if (activeChapterId === id) {
        const remainingChapters = activeBook.chapters.filter(c => c.id !== id);
        setActiveChapterId(remainingChapters[0]?.id || '');
      }
    }
  };

  const handleAddEntity = (entity: Entity) => updateActiveBook(b => ({ ...b, entities: [...b.entities, entity] }));
  const handleUpdateEntity = (entity: Entity) => updateActiveBook(b => ({ ...b, entities: b.entities.map(e => e.id === entity.id ? entity : e) }));
  const handleDeleteEntity = (id: string) => updateActiveBook(b => ({ ...b, entities: b.entities.filter(e => e.id !== id) }));

  // --- Chapter Summary Handlers ---
  const handleGenerateSummary = async (chapterContent: string, modelId: string, promptTemplate?: string): Promise<string> => {
    const selectedModel = settings.models?.find(m => m.id === modelId);
    if (!selectedModel) {
      throw new Error('选择的模型不存在');
    }
    const summary = await generateChapterSummary(selectedModel, chapterContent, promptTemplate);

    // Log to AI Logs
    aiLogsAPI.save({
      actionType: 'summary',
      category: 'summary',
      prompt: `Template: ${promptTemplate || 'Default'}\nContent Length: ${chapterContent.length}`,
      response: summary,
      modelName: selectedModel.modelName,
      bookId: activeBook?.id
    }).catch(console.error);

    return summary;
  };

  const handleSaveSummary = (summary: string) => {
    updateActiveBook(book => ({
      ...book,
      chapters: book.chapters.map(c => c.id === activeChapterId ? { ...c, summary } : c)
    }));
  };

  // --- AI Handlers ---
  const handleGenerate = async (prompt: string, modelId?: string, category?: string) => {
    if (isGenerating || !activeBook || !activeChapter) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: prompt, timestamp: Date.now() };
    setChatHistory(prev => [...prev, userMsg]);
    setIsGenerating(true);

    try {
      const selectedEntities = activeBook.entities.filter(e => selectedEntityIds.includes(e.id));

      // Get linked chapters based on chapterLinks
      const selectedChapters = chapterLinks.map(link => {
        const chapter = activeBook.chapters.find(c => c.id === link.chapterId);
        if (!chapter) return null;

        // Return chapter with only the requested content type
        if (link.type === 'summary') {
          return { ...chapter, content: chapter.summary || '' };
        }
        return chapter;
      }).filter(Boolean) as Chapter[];

      // Get model: specified > default > first
      let modelConfig = modelId ? settings.models?.find(m => m.id === modelId) : undefined;
      if (!modelConfig) {
        modelConfig = settings.models?.find(m => m.id === settings.defaultModelId) || settings.models?.[0];
      }

      if (!modelConfig) {
        throw new Error('没有配置模型,请在设置中添加模型。');
      }

      const responseText = await generateNovelContent({
        modelConfig: modelConfig,
        userPrompt: prompt,
        selectedEntities,
        selectedChapters,
        activeChapter,
        previousChapterSummary: "（暂无前情提要）"
      });

      // Log to AI Logs ONLY if category is present
      if (category) {
        aiLogsAPI.save({
          actionType: 'generate',
          category: category,
          prompt: prompt,
          response: responseText,
          modelName: modelConfig.modelName,
          bookId: activeBook.id
        }).catch(console.error);
      }

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
      const defaultModel = settings.models?.find(m => m.id === settings.defaultModelId) || settings.models?.[0];
      if (!defaultModel) {
        throw new Error('没有配置模型');
      }
      const result = await generateWorldviewFromIdea(defaultModel, idea.content);

      // Log to AI Logs
      aiLogsAPI.save({
        actionType: 'worldview',
        category: 'worldview',
        prompt: `Idea: ${idea.name}\nContent: ${idea.content}`,
        response: result,
        modelName: defaultModel.modelName,
        bookId: undefined
      }).catch(console.error);

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

  // --- Auth Check ---
  if (isAuthChecking) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-100">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage onLogin={() => {
      setIsAuthenticated(true);
      // Trigger data load
      window.location.reload();
    }} />;
  }

  // --- Loading State ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-lg text-gray-400">加载数据中...</p>
        </div>
      </div>
    );
  }

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
            onDeleteChapter={handleDeleteChapter}
            activeView={activeView}
            onSelectView={setActiveView}
            onBackToShelf={() => setActiveBookId(null)}
            onOpenSettings={() => setShowSettings(true)}
            selectedEntityType={selectedEntityType}
            onSelectEntityType={setSelectedEntityType}
          />
        )}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {settings.appearance.immersiveMode && (
            <button onClick={() => handleSaveSettings({ ...settings, appearance: { ...settings.appearance, immersiveMode: false } })} className="absolute top-4 right-8 z-50 bg-gray-900/50 p-2 rounded-full backdrop-blur-sm hover:text-indigo-400">
              <Minimize2 className="w-5 h-5" />
            </button>
          )}
          {activeView === 'editor' && activeChapter ? (
            <>
              <EditorToolbar
                onOpenAI={() => setShowAIAssistant(true)}
                onOpenSummary={() => setShowSummaryModal(true)}
                chapterTitle={activeChapter.title}
                onAutoFormat={() => {
                  // Auto-format: normalize spacing, paragraphs, etc.
                  const content = activeChapter.content;
                  const formatted = content
                    // Remove multiple consecutive empty lines
                    .replace(/\n{3,}/g, '\n\n')
                    // Add space after Chinese punctuation if followed by text
                    .replace(/([。！？；：」』】）"'])\s*(?=\S)/g, '$1\n\n')
                    // Trim each line
                    .split('\n')
                    .map(line => line.trim())
                    .join('\n')
                    // Remove leading/trailing whitespace
                    .trim();
                  handleUpdateChapterContent(formatted);
                }}
              />
              <div className="flex-1 overflow-hidden relative">
                <Editor
                  chapter={activeChapter}
                  onChange={handleUpdateChapterContent}
                  onTitleChange={handleUpdateChapterTitle}
                  onOpenSummary={() => setShowSummaryModal(true)}
                  fontSize={settings.appearance.fontSize}
                />
              </div>

              <ChapterSummaryModal
                isOpen={showSummaryModal}
                onClose={() => setShowSummaryModal(false)}
                chapter={activeChapter}
                prompts={prompts}
                models={settings.models || []}
                defaultModelId={settings.defaultModelId || ''}
                onGenerateSummary={handleGenerateSummary}
                onSaveSummary={handleSaveSummary}
              />
            </>
          ) : (
            <WikiView
              entities={activeBook.entities}
              onAddEntity={handleAddEntity}
              onUpdateEntity={handleUpdateEntity}
              onDeleteEntity={handleDeleteEntity}
              onGenerateWorldview={handleGenerateWorldview}
              isGenerating={isGenerating}
              selectedType={selectedEntityType}
            />
          )}
        </main>

        <AIAssistantModal
          isOpen={showAIAssistant}
          onClose={() => setShowAIAssistant(false)}
          entities={activeBook.entities}
          selectedEntityIds={selectedEntityIds}
          onToggleEntity={(id) => setSelectedEntityIds(p => p.includes(id) ? p.filter(e => e !== id) : [...p, id])}
          chapters={activeBook.chapters}
          activeChapterId={activeChapterId}
          chapterLinks={chapterLinks}
          onUpdateChapterLinks={setChapterLinks}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          chatHistory={chatHistory}
          prompts={prompts}
          models={settings.models || []}
          defaultModelId={settings.defaultModelId}
          onInsertToChapter={(content) => {
            // Insert AI generated content at the end of the chapter
            const currentContent = activeChapter?.content || '';
            const newContent = currentContent + (currentContent ? '\n\n' : '') + content;
            handleUpdateChapterContent(newContent);
          }}
        />
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
          <button onClick={() => setShowProfile(true)} className="p-2 text-gray-500 hover:text-white transition-colors" title="个人中心">
            <User className="w-5 h-5" />
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2 text-gray-500 hover:text-white transition-colors" title="全局设置">
            <Settings className="w-5 h-5" />
          </button>
          <button onClick={() => setShowAILogs(true)} className="p-2 text-gray-500 hover:text-white transition-colors" title="历史记录">
            <History className="w-5 h-5" />
          </button>
        </div>
      </div>

      <UserProfileModal
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        onLogout={handleLogout}
      />

      {/* Main Dashboard Content */}
      <div className="flex-1 overflow-hidden bg-gray-950 relative">
        {dashboardTab === 'bookshelf' && (
          <Bookshelf
            books={books}
            onSelectBook={handleSelectBook}
            onCreateBook={handleCreateBook}
            onUpdateBook={handleUpdateBook}
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
      <AILogViewer
        isOpen={showAILogs}
        onClose={() => setShowAILogs(false)}
      />

      {activeBook && activeChapter && (
        <AIAssistantModal
          isOpen={showAIAssistant}
          onClose={() => setShowAIAssistant(false)}
          entities={activeBook.entities}
          selectedEntityIds={selectedEntityIds}
          onToggleEntity={(id) => setSelectedEntityIds(p => p.includes(id) ? p.filter(e => e !== id) : [...p, id])}
          chapters={activeBook.chapters}
          activeChapterId={activeChapterId}
          chapterLinks={chapterLinks}
          onUpdateChapterLinks={setChapterLinks}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          chatHistory={chatHistory}
          prompts={prompts}
          models={settings.models || []}
          defaultModelId={settings.defaultModelId}
        />
      )}
    </div>
  );
};

export default App;
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';

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
import { Library, Lightbulb, Settings, Terminal, Minimize2, Loader2, User, History, FileText, Plus } from 'lucide-react';

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
const DEFAULT_PROMPTS: PromptTemplate[] = [];

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
        // Filter out built-in prompts to enforce "delete built-in prompts" policy
        const loadedPrompts = promptsData.length > 0 ? promptsData : DEFAULT_PROMPTS;
        setPrompts(loadedPrompts.filter(p => !p.isBuiltIn));
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

  // Apply theme to document
  useEffect(() => {
    const theme = settings.appearance?.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  }, [settings.appearance?.theme]);

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
    // Build comprehensive entity list from Idea data
    const newEntities: Entity[] = [];

    // 1. Spark (Core Idea)
    if (idea.spark) {
      newEntities.push({
        id: Date.now() + '_spark',
        type: EntityType.IDEA,
        name: '核心灵感 (Spark)',
        description: '作品的初始灵感来源',
        tags: ['灵感', '核心梗'],
        content: idea.spark
      });
    }

    // 2. Worldview (if exists)
    if (idea.worldview) {
      newEntities.push({
        id: Date.now() + '_w',
        type: EntityType.WORLDVIEW,
        name: '世界观设定',
        description: '基于灵感实验室生成',
        tags: ['核心设定', '世界观'],
        content: idea.worldview
      });
    }

    // 3. Storyline (Story Arc)
    if (idea.storyline) {
      newEntities.push({
        id: Date.now() + '_story',
        type: EntityType.PLOT,
        name: '故事主线',
        description: '初步构思的故事脉络',
        tags: ['大纲', '故事线'],
        content: idea.storyline
      });
    }

    // 4. Full Outline
    if (idea.outline) {
      newEntities.push({
        id: Date.now() + '_p',
        type: EntityType.PLOT,
        name: '全书大纲',
        description: '三幕式结构',
        tags: ['大纲', '结构'],
        content: idea.outline
      });
    }

    // 5. Volumes (Volume Outline)
    if (idea.volumes && idea.volumes.length > 0) {
      const volumeContent = idea.volumes.map(v =>
        `### 第 ${v.order} 卷：${v.title}\n${v.summary}`
      ).join('\n\n');

      newEntities.push({
        id: Date.now() + '_volumes',
        type: EntityType.PLOT,
        name: '分卷规划',
        description: '按卷划分的剧情大纲',
        tags: ['大纲', '分卷'],
        content: volumeContent
      });
    }

    const newBook: Book = {
      id: Date.now().toString(),
      title: idea.title,
      author: 'User',
      description: idea.spark,
      status: 'serializing',
      cover: 'from-yellow-600 to-orange-600',
      entities: newEntities,
      chapters: idea.chapterBeats && idea.chapterBeats.length > 0
        ? idea.chapterBeats.map((beat, idx) => ({
          id: Date.now() + `_c${idx}`,
          title: beat.chapterTitle,
          summary: beat.summary,
          content: `【本章摘要】\n${beat.summary}\n\n【核心冲突】\n${beat.conflict}\n\n【出场人物】\n${beat.keyCharacters.join(', ')}\n\n(在此开始写作...)`
        }))
        : [{ id: Date.now() + '_c', title: '第一章', content: '' }]
    };

    setBooks(prev => [...prev, newBook]);
    // Link the idea to the new book automatically
    handleUpdateIdea(idea.id, { linkedBookId: newBook.id });
    
    alert(`成功将《${idea.title}》转化为书籍！所有灵感数据已保存至设定集。`);
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

  // Helper: Parse chapter number (supports Arabic and Chinese numerals)
  const parseChapterNumber = (title: string): number => {
    // 1. Try Arabic numerals
    const arabicMatch = title.match(/(\d+)/);
    if (arabicMatch) return parseInt(arabicMatch[0], 10);

    // 2. Try Chinese numerals (Simple implementation for common cases)
    const cnNums: { [key: string]: number } = {
      '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
      '百': 100, '千': 1000, '两': 2
    };

    // Extract potential Chinese number string (e.g., "第一千零一章" -> "一千零一")
    const cnMatch = title.match(/[零一二三四五六七八九十百千两]+/);
    if (!cnMatch) return 0;

    const str = cnMatch[0];
    let result = 0;
    let temp = 0;
    let unit = 1;

    for (let i = 0; i < str.length; i++) {
      const val = cnNums[str[i]];
      if (val >= 10) {
        if (val > unit) {
          unit = val;
          result = (result + temp) * val;
          temp = 0;
          unit = 1; // reset unit for next section
        } else {
          result += (temp || (i === 0 ? 1 : 0)) * val; // Handle "十" at start as 10
          temp = 0;
        }
      } else {
        temp = val;
      }
    }
    result += temp;

    // Special case for "十" (10), "十一" (11) etc. if logic above missed simple tens
    if (result === 0 && str.includes('十')) {
      // Fallback for simple tens if the loop logic was too strict for mixed cases
      // But the loop above should handle "十一" -> 1*10 + 1 = 11
    }

    return result;
  };

  const handleSortChapters = (order: 'asc' | 'desc') => {
    updateActiveBook(book => {
      const sortedChapters = [...book.chapters].sort((a, b) => {
        const numA = parseChapterNumber(a.title);
        const numB = parseChapterNumber(b.title);

        // If both have numbers, compare numbers
        if (numA !== 0 && numB !== 0) {
          return order === 'asc' ? numA - numB : numB - numA;
        }

        // Fallback to string comparison
        return order === 'asc'
          ? a.title.localeCompare(b.title, 'zh-CN')
          : b.title.localeCompare(a.title, 'zh-CN');
      });
      return { ...book, chapters: sortedChapters };
    });
  };

  const handleDeleteChapter = (id: string) => {
    if (!activeBook) return;
    // Removed restriction to keep at least one chapter
    if (window.confirm('确定要删除这个章节吗？')) {
      updateActiveBook(book => {
        const newChapters = book.chapters.filter(c => c.id !== id);
        return { ...book, chapters: newChapters };
      });
      // If deleting active chapter, switch to first chapter or empty string
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

  const handlePushChaptersToBook = (bookId: string, chapters: Chapter[]) => {
    const targetBook = books.find(b => b.id === bookId);
    if (!targetBook) return;

    // Check for duplicates
    const existingTitles = new Set(targetBook.chapters.map(c => c.title));
    const duplicates = chapters.filter(c => existingTitles.has(c.title));

    if (duplicates.length > 0) {
      if (!window.confirm(`检测到 ${duplicates.length} 个同名章节（如 "${duplicates[0].title}"），是否覆盖？`)) {
        return;
      }
    }

    const newChapters = [...targetBook.chapters];
    chapters.forEach(newChap => {
      const idx = newChapters.findIndex(c => c.title === newChap.title);
      if (idx >= 0) {
        // Keep ID if overwriting to preserve selection state if applicable
        newChapters[idx] = { ...newChap, id: newChapters[idx].id };
      } else {
        newChapters.push(newChap);
      }
    });

    handleUpdateBook({ ...targetBook, chapters: newChapters });
    alert(`成功推送 ${chapters.length} 个章节到《${targetBook.title}》`);
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

      // Find the previous chapter's summary
      const currentChapterIndex = activeBook.chapters.findIndex(c => c.id === activeChapterId);
      const previousChapter = currentChapterIndex > 0 ? activeBook.chapters[currentChapterIndex - 1] : null;
      const previousChapterSummary = previousChapter?.summary || '（无）';

      const responseText = await generateNovelContent({
        modelConfig: modelConfig,
        userPrompt: prompt,
        selectedEntities,
        selectedChapters,
        activeChapter,
        previousChapterSummary: previousChapterSummary
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
            onSortChapters={handleSortChapters}
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
          {activeView === 'editor' ? (
            activeChapter ? (
              <>
                <EditorToolbar
                  onOpenAI={() => setShowAIAssistant(true)}
                  onOpenSummary={() => setShowSummaryModal(true)}
                  chapterTitle={activeChapter.title}
                  onAutoFormat={() => {
                    // Auto-format: normalize spacing, paragraphs
                    const content = activeChapter.content;
                    const formatted = content
                      // Normalize newlines
                      .replace(/\r\n/g, '\n')
                      .replace(/\r/g, '\n')
                      // Split into lines
                      .split('\n')
                      // Trim whitespace from each line
                      .map(line => line.trim())
                      // Remove empty lines
                      .filter(line => line.length > 0)
                      // Join with double newline for paragraph spacing
                      .join('\n\n');
                    
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
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 h-full bg-gray-950">
                <div className="bg-gray-900/50 p-12 rounded-xl border border-gray-800 flex flex-col items-center">
                  <FileText className="w-16 h-16 mb-6 opacity-20" />
                  <p className="mb-6 text-lg font-medium">
                    {activeBook.chapters.length === 0 ? '还没有章节' : '请选择一个章节'}
                  </p>
                  <button
                    onClick={handleCreateChapter}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center transition-colors shadow-lg shadow-indigo-500/20"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    新建章节
                  </button>
                </div>
              </div>
            )
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
            books={books}
            settings={settings}
            prompts={prompts}
            onCreateIdea={handleCreateIdea}
            onUpdateIdea={handleUpdateIdea}
            onDeleteIdea={handleDeleteIdea}
            onConvertToBook={handleConvertIdeaToBook}
            onSelectBook={handleSelectBook}
            onPushChapters={handlePushChaptersToBook}
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
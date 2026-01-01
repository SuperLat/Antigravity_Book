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
const INITIAL_BOOKS: Book[] = [];

// Built-in Default Prompts - These are the default templates used by AI generation functions
const BUILTIN_PROMPTS: PromptTemplate[] = [
  // === 脑洞/灵感 (Brainstorm) ===
  {
    id: 'builtin_story_core',
    name: '故事内核与概要生成',
    description: '从核心灵感生成故事内核和概要',
    category: 'brainstorm',
    isBuiltIn: true,
    isDefault: true,
    template: `【核心脑洞/灵感】：{{spark}}
{{options}}

请基于以上信息，提炼出故事内核（Story Core）并撰写一个故事概要（Story Synopsis）。

要求：
1. 故事内核：用一句话或简短的几句话描述故事最深层的哲学内涵、情感核心或最本质的冲突。
2. 故事概要：约 300-500 字，包含背景设定、主角动机、核心危机以及大致的发展方向。

请严格以 JSON 格式返回，不要包含任何 markdown 代码块标记，格式如下：
{
  "core": "故事内核内容...",
  "synopsis": "故事概要内容..."
}`
  },
  {
    id: 'builtin_storyline',
    name: '故事线梳理',
    description: '将灵感转化为清晰的故事线',
    category: 'brainstorm',
    isBuiltIn: true,
    template: `【原始灵感】：{{spark}}
{{core}}
{{synopsis}}

请基于以上信息，梳理出一条清晰、完整的故事线（Storyline）。

要求：
1. 明确故事的主角及其核心目标。
2. 概括故事的起因、经过和结果（Start, Middle, End）。
3. 包含关键的转折点和高潮事件。
4. 既然是故事线，请注重逻辑连贯性，字数控制在 500-800 字左右。

请直接输出故事线内容。`
  },

  // === 世界观构建 (World) ===
  {
    id: 'builtin_worldview',
    name: '世界观草案',
    description: '基于灵感构建世界观设定',
    category: 'world',
    isBuiltIn: true,
    isDefault: true,
    template: `核心梗/脑洞：【{{input}}】

请基于上述核心梗，设计一个精炼的世界观草案。

要求包含以下内容（请保持简明扼要）：
1. 力量体系名称及等级划分。
2. 社会结构与核心阶层矛盾。
3. 核心能源或驱动力是什么。
4. 独特的地理环境或城市风貌。

请使用结构清晰的 Markdown 格式输出。`
  },
  {
    id: 'builtin_detailed_worldview',
    name: '详细世界观构建',
    description: '基于故事设定生成详细世界观',
    category: 'world',
    isBuiltIn: true,
    template: `基于以下故事信息，设计一个精炼且逻辑自洽的世界观背景。

【故事篇幅】：{{storyLength}}
【故事内核】：{{core}}
【故事概要】：{{synopsis}}
【初步设定】：类型：{{genre}}，基础背景：{{background}}

要求包含以下内容（请保持简明扼要，避免冗长）：
1. 世界背景：简述故事发生的空间设定。
2. 力量/技术体系：概括核心逻辑（如修仙等级、科技水平、魔法法则等）。
3. 核心冲突源：点出导致故事发生的深层诱因。

请使用结构清晰的 Markdown 格式输出，重点在于核心设定的构建，非核心细节可适当留白。`
  },

  // === 大纲生成 (Outline) ===
  {
    id: 'builtin_outline_from_worldview',
    name: '三幕式大纲',
    description: '基于世界观生成小说大纲',
    category: 'outline',
    isBuiltIn: true,
    isDefault: true,
    template: `【核心梗】：{{spark}}
【世界观设定】：{{worldview}}

请基于以上信息，设计一个标准的三幕式小说大纲。
要求：
1. 主角背景设定（底层贫民/意外卷入者等）。
2. 每一幕（第一卷、第二卷、第三卷）的核心冲突和高潮点。
3. 结局的初步构想。

请用 Markdown 格式输出。`
  },
  {
    id: 'builtin_complete_outline',
    name: '完整分卷大纲',
    description: '综合所有素材生成详尽的全书大纲',
    category: 'outline',
    isBuiltIn: true,
    template: `{{context}}

--- 任务指令 ---
请综合以上素材，创作一份详尽的**全书大纲**。

**输出格式要求（必须严格遵守）**：

# 全书大纲

## 一、故事主线
（在此处用精炼的语言概括贯穿全书的核心剧情线索，约300-500字。）

## 二、分卷细纲

### 第一卷：[卷名]
**主要内容**：
（详细描述本卷的主线剧情发展，核心冲突与高潮。）
**支线内容**：
（描述本卷并行的支线剧情，如配角成长、感情线、隐藏伏笔等。）

### 第二卷：[卷名]
**主要内容**：...
**支线内容**：...

（后续分卷以此类推...）

**内容要求**：
1. **深度融合**：剧情必须体现【角色】的性格特征和【世界观】的独特规则。
2. **结构严谨**：采用分卷结构，确保每一卷都有明确的起承转合。
3. **主次分明**：主要内容要紧扣核心冲突，支线内容要丰富世界观和人物关系。

请以 Markdown 格式输出。`
  },
  {
    id: 'builtin_parts_from_volume',
    name: '分卷细化为分部',
    description: '将卷大纲拆分为分部',
    category: 'outline',
    isBuiltIn: true,
    template: `作为一名资深网文策划，请根据以下卷大纲，将其拆分为 2-4 个"分部"（Part）。
每个分部应该是该卷内的一个阶段性剧情单元，有明确的起承转合。

卷标题：{{volumeTitle}}
卷大纲：
{{volumeSummary}}

请以 JSON 数组格式返回，格式如下：
[
  {
    "title": "第一部：分部名",
    "summary": "本分部的详细剧情摘要..."
  },
  ...
]
只返回 JSON 数据，不要包含 markdown 标记或其他文本。`
  },

  // === 细纲编排 (Chapter Beats) ===
  {
    id: 'builtin_chapter_beats',
    name: '章节细纲拆解',
    description: '将大纲拆解为章节细纲',
    category: 'beats',
    isBuiltIn: true,
    isDefault: true,
    template: `【小说大纲】：{{outline}}

请基于大纲的第一部分（第一卷），拆分为 5-8 个具体的章节细纲。

请严格返回 JSON 格式，数组结构，不要包含 markdown 代码块标记。格式如下：
[
  {
    "chapterTitle": "第一章：具体标题",
    "summary": "第一章的具体事件摘要...",
    "keyCharacters": ["主角名", "配角名"],
    "conflict": "核心冲突点"
  },
  ...
]`
  },
  {
    id: 'builtin_beats_from_volume',
    name: '分卷内容细纲拆解',
    description: '将分卷内容拆分为带场景的章节细纲',
    category: 'beats',
    isBuiltIn: true,
    template: `【核心灵感】：{{spark}}
【故事内核】：{{core}}
【故事概要】：{{synopsis}}
【世界观设定】：{{worldview}}
【核心角色】：{{characters}}
{{reference}}

【待拆解的分卷/剧情内容】：
{{volumeContent}}

--- 任务指令 ---
请结合上述【世界观】、【角色】、【前文剧情】和【故事背景】，将【待拆解的分卷内容】拆分为 {{chapterCount}} 个连续的章节细纲。
章节编号从第 {{startChapter}} 章开始。

要求：
1. **承接上文**：如果提供了【前文剧情/参考章节】，请确保生成的章节与其无缝衔接，保持情节和人物状态的连贯性。
2. **章节细化**：每个章节必须拆分为 5-6 个具体的对话场景。
3. **场景描述**：简述每个场景中对话要交代的关键线索或冲突点。
4. **字数规划**：为每个场景规划字数分配，确保全章总字数在 2500 字左右。
5. **核心冲突**：明确标出每一章的核心冲突和出场关键角色。
6. **严禁合并**：必须严格按照要求的章节数进行拆解。`
  },

  // === 角色设计 (Character) ===
  {
    id: 'builtin_character_design',
    name: '角色人物设计',
    description: '基于故事设定生成角色人物小传',
    category: 'character',
    isBuiltIn: true,
    isDefault: true,
    template: `【灵感/脑洞】：{{spark}}
【故事内核】：{{core}}
【故事概要】：{{synopsis}}
【世界观设定】：{{worldview}}

请基于以上故事设定，设计核心角色。

要求：
1. 角色性格要鲜明，有独特的辨识度。
2. 角色背景要与世界观深度结合。
3. 角色之间要有充满张力的关系。
4. 请精简输出，【背景故事】和【性格描述】请严格控制在 100 字以内，避免过长导致内容截断。

请严格返回 JSON 格式，数组结构，不要包含 markdown 代码块标记。格式如下：
[
  {
    "name": "角色名",
    "role": "主角/反派/重要配角",
    "gender": "男/女/其他",
    "age": "年龄或视觉年龄",
    "description": "简短的一句话介绍",
    "personality": "详细的性格描述(100字内)...",
    "appearance": "详细的外貌描写...",
    "background": "详细的角色背景故事(100字内)..."
  },
  ...
]`
  },

  // === 正文写作 (Drafting) ===
  {
    id: 'builtin_chapter_draft',
    name: '章节续写',
    description: '基于设定和上下文续写章节正文',
    category: 'drafting',
    isBuiltIn: true,
    isDefault: true,
    template: `请根据当前章节的上下文和关联的设定，继续撰写后续剧情。

要求：
1. 保持现有文本的风格和语气。
2. 情节发展要自然连贯。
3. 人物言行要符合其性格设定。
4. 适当运用细节描写增强画面感。

{{input}}`
  },
  {
    id: 'builtin_expand_scene',
    name: '场景扩写',
    description: '扩展当前场景的细节描写',
    category: 'drafting',
    isBuiltIn: true,
    template: `请对当前场景进行扩写，增加更多生动的细节。

要求：
1. 增加环境描写，营造氛围。
2. 丰富角色的动作、神态和心理描写。
3. 适当增加对话，推动剧情发展。
4. 保持原有的叙事节奏。

{{input}}`
  },

  // === 润色优化 (Refining) ===
  {
    id: 'builtin_polish',
    name: '文本润色',
    description: '优化文本表达，提升文学性',
    category: 'refining',
    isBuiltIn: true,
    isDefault: true,
    template: `请对以下文本进行润色优化：

{{input}}

要求：
1. 优化句式结构，使表达更流畅。
2. 丰富词汇运用，避免重复用词。
3. 增强文学性和画面感。
4. 保持原意不变，语气风格一致。`
  },
  {
    id: 'builtin_chapter_summary',
    name: '章节概要生成',
    description: '为章节内容生成精炼概要',
    category: 'refining',
    isBuiltIn: true,
    isDefault: true,
    template: `请为以下章节内容生成一个简洁的概要（100-200字）：

【章节内容】
{{content}}

要求：
1. 概括本章的核心事件和情节发展
2. 提及关键角色和他们的行动
3. 突出本章的冲突或转折点
4. 简明扼要，便于后续章节参考

请直接输出概要内容，不要包含其他说明。`
  },

  // === 通用指令 (General) ===
  {
    id: 'builtin_general',
    name: '通用创作助手',
    description: '通用的小说创作辅助指令',
    category: 'general',
    isBuiltIn: true,
    isDefault: true,
    template: `作为专业的小说创作助手，请根据用户的需求提供帮助。

用户需求：{{input}}

请基于提供的上下文和设定，给出专业、详细的回应。`
  }
];

// Legacy empty array for compatibility
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
  },
  genres: ['玄幻', '奇幻', '仙侠', '武侠', '科幻', '悬疑', '都市', '历史', '游戏', '轻小说'],
  backgrounds: ['东方玄幻', '西方奇幻', '赛博朋克', '废土末世', '现代都市', '古代架空', '星际文明', '克苏鲁', '蒸汽朋克']
};

// Helper for lazy loading
const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultValue;
    const parsed = JSON.parse(stored);
    return parsed !== null && parsed !== undefined ? parsed : defaultValue;
  } catch (e) {
    console.error(`Failed to load ${key}`, e);
    return defaultValue;
  }
};

// Migration helper: Convert old AIConfig to new ModelConfig array
const migrateSettings = (settings: AppSettings): AppSettings => {
  // Ensure genres and backgrounds exist
  if (!settings.genres) {
    settings.genres = DEFAULT_SETTINGS.genres;
  }
  if (!settings.backgrounds) {
    settings.backgrounds = DEFAULT_SETTINGS.backgrounds;
  }

  // If already migrated models, return
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

        setBooks(Array.isArray(booksData) ? booksData : []);
        setIdeas(Array.isArray(ideasData) ? ideasData : []);

        // Merge built-in prompts with user prompts
        // User's modified versions of built-in prompts override the defaults
        const userPrompts = Array.isArray(promptsData) ? promptsData : [];
        const userPromptIds = new Set(userPrompts.map(p => p.id));

        // Start with built-in prompts that haven't been overridden by user
        const mergedPrompts: PromptTemplate[] = BUILTIN_PROMPTS.map(builtIn => {
          // Check if user has a modified version of this built-in prompt
          const userVersion = userPrompts.find(p => p.id === builtIn.id);
          if (userVersion) {
            // Use user's version but ensure isBuiltIn flag is preserved
            return { ...userVersion, isBuiltIn: true };
          }
          return builtIn;
        });

        // Add user's custom (non-built-in) prompts
        const customPrompts = userPrompts.filter(p => !p.id.startsWith('builtin_'));
        mergedPrompts.push(...customPrompts);

        setPrompts(mergedPrompts);
        setSettings(settingsData ? migrateSettings(settingsData) : DEFAULT_SETTINGS);
      } catch (error) {
        console.error('Failed to load data:', error);
        // Fallback to LocalStorage + built-in prompts
        setBooks(loadFromStorage('novelcraft_books', INITIAL_BOOKS) || []);
        setIdeas(loadFromStorage('novelcraft_ideas', []) || []);

        // Even on error, include built-in prompts
        const storedPrompts = loadFromStorage('novelcraft_prompts', DEFAULT_PROMPTS) || [];
        const mergedPrompts = [...BUILTIN_PROMPTS];
        storedPrompts.forEach(p => {
          if (!p.id.startsWith('builtin_')) {
            mergedPrompts.push(p);
          }
        });
        setPrompts(mergedPrompts);

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

  const handleDeleteBook = async (id: string) => {
    if (window.confirm('确定要删除这本书吗？')) {
      try {
        await booksAPI.delete(id);
        setBooks(prev => prev.filter(b => b.id !== id));

        // Unlink associated idea if exists
        const linkedIdea = ideas.find(i => i.linkedBookId === id);
        if (linkedIdea) {
          const updatedIdea = { ...linkedIdea, linkedBookId: undefined };
          setIdeas(prev => prev.map(i => i.id === linkedIdea.id ? updatedIdea : i));
          await ideasAPI.save(updatedIdea);
        }
      } catch (error) {
        console.error("Failed to delete book", error);
        alert("删除失败，请重试");
      }
    }
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
      storyCore: '',
      storySynopsis: '',
      storyLength: 'long',
      storyGenre: '',
      storyBackground: '',
      worldview: '',
      outline: '',
      chapterBeats: [],
    };
    setIdeas(prev => [newIdea, ...prev]);
  };

  const handleUpdateIdea = (id: string, updates: Partial<IdeaProject>) => {
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const handleDeleteIdea = async (id: string) => {
    if (window.confirm('确定删除此灵感项目吗？')) {
      try {
        await ideasAPI.delete(id);
        setIdeas(prev => prev.filter(i => i.id !== id));
      } catch (error) {
        console.error("Failed to delete idea", error);
        alert("删除失败，请重试");
      }
    }
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

    // 1.1 Story Core
    if (idea.storyCore) {
      newEntities.push({
        id: Date.now() + '_core',
        type: EntityType.IDEA,
        name: '故事内核 (Core)',
        description: '故事最深层的哲学内涵或情感核心',
        tags: ['内核', '灵感'],
        content: idea.storyCore
      });
    }

    // 1.2 Story Synopsis
    if (idea.storySynopsis) {
      newEntities.push({
        id: Date.now() + '_synopsis',
        type: EntityType.PLOT,
        name: '故事概要 (Synopsis)',
        description: '故事的背景设定和发展方向',
        tags: ['概要', '大纲'],
        content: idea.storySynopsis
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

    // 6. Characters (Character Profiles)
    if (idea.characters && idea.characters.length > 0) {
      idea.characters.forEach((char, index) => {
        newEntities.push({
          id: Date.now() + `_char_${index}`,
          type: EntityType.CHARACTER,
          name: char.name,
          description: char.description || `${char.role}`,
          tags: ['人物', char.role],
          content: `【姓名】：${char.name}
【定位】：${char.role}
【性别】：${char.gender || '未知'}
【年龄】：${char.age || '未知'}
【一句话介绍】：${char.description}
【性格特征】：${char.personality || '暂无'}
【外貌描写】：${char.appearance || '暂无'}
【背景故事】：${char.background || '暂无'}`
        });
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
        ? idea.chapterBeats.map((beat, idx) => {
          // Format scenes into content (consistent with handlePushBeatsToBook)
          let chapterContent = '';
          if (beat.scenes && beat.scenes.length > 0) {
            chapterContent = beat.scenes.map(scene =>
              `### ${scene.sceneTitle} (${scene.wordCount})\n\n${scene.detail}`
            ).join('\n\n');
          } else {
            // Fallback to summary-based content if no scenes
            chapterContent = `【本章摘要】\n${beat.summary}\n\n【核心冲突】\n${beat.conflict}\n\n【出场人物】\n${beat.keyCharacters ? beat.keyCharacters.join(', ') : ''}\n\n(在此开始写作...)`;
          }

          // Add extra metadata to summary
          const chapterSummary = beat.summary +
            (beat.conflict ? `\n\n【冲突】${beat.conflict}` : '') +
            (beat.keyCharacters && beat.keyCharacters.length > 0 ? `\n【角色】${beat.keyCharacters.join(', ')}` : '');

          return {
            id: Date.now().toString() + `_c${idx}`,
            title: beat.chapterTitle,
            summary: chapterSummary,
            content: chapterContent
          };
        })
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

  const handleDeletePrompt = async (id: string) => {
    if (window.confirm('确定删除此指令吗？')) {
      try {
        await promptsAPI.delete(id);
        setPrompts(prev => prev.filter(p => p.id !== id));
      } catch (error) {
        console.error("Failed to delete prompt", error);
        alert("删除失败，请重试");
      }
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

  const handleBatchDeleteChapters = (ids: string[]) => {
    if (!activeBook || ids.length === 0) return;
    updateActiveBook(book => {
      const newChapters = book.chapters.filter(c => !ids.includes(c.id));
      return { ...book, chapters: newChapters };
    });
    // If active chapter is among those deleted, switch to the first remaining one
    if (ids.includes(activeChapterId)) {
      const remainingChapters = activeBook.chapters.filter(c => !ids.includes(c.id));
      setActiveChapterId(remainingChapters[0]?.id || '');
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

    // Build a map of existing chapter numbers to their indices
    const existingChapterMap = new Map<number, { index: number; title: string }>();
    targetBook.chapters.forEach((c, idx) => {
      const num = parseChapterNumber(c.title);
      if (num > 0) {
        existingChapterMap.set(num, { index: idx, title: c.title });
      }
    });

    // Check for duplicates by chapter number
    const duplicates: { newTitle: string; existingTitle: string; chapterNum: number }[] = [];
    chapters.forEach(c => {
      const num = parseChapterNumber(c.title);
      if (num > 0 && existingChapterMap.has(num)) {
        duplicates.push({
          newTitle: c.title,
          existingTitle: existingChapterMap.get(num)!.title,
          chapterNum: num
        });
      }
    });

    if (duplicates.length > 0) {
      // Build detailed message showing which chapters will be overwritten
      const duplicateNums = duplicates.map(d => d.chapterNum).sort((a, b) => a - b);
      const displayNums = duplicateNums.length <= 5
        ? duplicateNums.join('、')
        : `${duplicateNums.slice(0, 5).join('、')}...等`;

      if (!window.confirm(
        `检测到 ${duplicates.length} 个章节编号已存在（第 ${displayNums} 章），推送将覆盖现有内容。\n\n是否继续？`
      )) {
        return;
      }
    }

    const newChapters = [...targetBook.chapters];
    let overwriteCount = 0;
    let addCount = 0;

    chapters.forEach(newChap => {
      const newChapNum = parseChapterNumber(newChap.title);

      // First try to match by chapter number
      if (newChapNum > 0 && existingChapterMap.has(newChapNum)) {
        const existing = existingChapterMap.get(newChapNum)!;
        // Overwrite: keep original ID to preserve selection state
        newChapters[existing.index] = { ...newChap, id: newChapters[existing.index].id };
        overwriteCount++;
      } else {
        // Fallback: check exact title match
        const titleMatchIdx = newChapters.findIndex(c => c.title === newChap.title);
        if (titleMatchIdx >= 0) {
          newChapters[titleMatchIdx] = { ...newChap, id: newChapters[titleMatchIdx].id };
          overwriteCount++;
        } else {
          // New chapter
          newChapters.push(newChap);
          addCount++;
        }
      }
    });

    handleUpdateBook({ ...targetBook, chapters: newChapters });

    // Build result message
    let resultMsg = `成功推送到《${targetBook.title}》：`;
    if (addCount > 0) resultMsg += `新增 ${addCount} 章`;
    if (overwriteCount > 0) resultMsg += `${addCount > 0 ? '，' : ''}覆盖 ${overwriteCount} 章`;
    alert(resultMsg);
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

      // 优化：如果用户已经手动选择了关联章节，则不再自动注入上一章概要，避免内容冗余
      const currentChapterIndex = activeBook.chapters.findIndex(c => c.id === activeChapterId);
      const previousChapter = currentChapterIndex > 0 ? activeBook.chapters[currentChapterIndex - 1] : null;

      // 只有在没有手动关联章节时，才自动提供上一章概要
      const previousChapterSummary = selectedChapters.length === 0
        ? (previousChapter?.summary || '（无）')
        : undefined;

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
            onDeleteChapters={handleBatchDeleteChapters}
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
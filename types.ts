
export enum EntityType {
  CHARACTER = 'CHARACTER',
  WORLDVIEW = 'WORLDVIEW',
  PLOT = 'PLOT',
  IDEA = 'IDEA'
}

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  description: string;
  tags: string[];
  content: string; // Detailed info
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  summary?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  status: 'serializing' | 'completed'; // 连载中 | 已完结
  cover?: string; // Color code or image URL
  chapters: Chapter[];
  entities: Entity[]; // Entities now belong to a specific book
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export type PromptCategory = 'general' | 'drafting' | 'refining' | 'brainstorm' | 'character' | 'world' | 'outline' | 'beats';

export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  template: string; // Uses {{context}} {{input}} placeholders
  category: PromptCategory;
  isBuiltIn?: boolean; // If true, cannot be deleted (but can be edited or reset ideally, simple implementation: read-only or editable)
  isDefault?: boolean; // If true, this is the default prompt for its category
}

// --- Idea Lab Interfaces ---

export interface ChapterBeat {
  chapterTitle: string;
  summary: string;
  keyCharacters: string[];
  conflict: string;
}

// 细纲拆分记录
export interface BeatsSplit {
  id: string;
  volumeContent: string; // 卷内容
  chapterCount: number; // 拆分章数
  startChapter: number; // 起始章节号
  beats: ChapterBeat[]; // 拆分结果
  createdAt: number;
}

// 通用生成历史记录
export interface GenerationHistoryEntry {
  id: string;
  type: 'spark' | 'story' | 'world' | 'outline' | 'volume' | 'beats' | 'chapter';
  content: string; // 生成的主要内容
  prompt?: string; // 使用的提示词 (Optional)
  model: string; // 使用的模型
  createdAt: number;
}

export interface Part {
  id: string;
  title: string;
  summary: string;
  order: number;
}

export interface Volume {
  id: string;
  title: string;
  summary: string;
  order: number;
  parts?: Part[];
}

export interface CharacterProfile {
  id: string;
  name: string;
  role: string; // e.g. 主角, 反派, 配角
  gender?: string;
  age?: string;
  description: string; // Short bio
  background?: string; // Detailed background
  personality?: string; // Personality traits
  appearance?: string; // Appearance description
}

export interface IdeaProject {
  id: string;
  title: string;
  spark: string;
  storyCore?: string; // 新增：故事内核
  storySynopsis?: string; // 新增：故事概要
  storyLength?: 'short' | 'long'; // 新增：篇幅
  storyGenre?: string; // 新增：类型
  storyBackground?: string; // 新增：背景
  storyline?: string; // 新增：故事线
  worldview: string; // Keep for compatibility, or repurpose
  characters?: CharacterProfile[]; // 新增：角色人物小传
  outline: string;
  volumes?: Volume[];
  chapterBeats?: ChapterBeat[];
  beatsSplitHistory?: BeatsSplit[];
  lastSplitChapterNum?: number;
  linkedBookId?: string; // ID of the actual book project this idea is linked to
  generationHistory?: GenerationHistoryEntry[]; // 新增：生成历史
}

// --- Settings Interfaces ---

export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'ollama' | 'custom';

// Legacy interface for backward compatibility
export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  contextWindow: number;
}

// New model configuration interface
export interface ModelConfig {
  id: string;
  name: string; // User-friendly name
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string; // Custom endpoint for all providers
  modelName: string;
  temperature: number;
  maxTokens: number;
  contextWindow: number;
  enableThinking?: boolean; // 新增：是否启用思考模式 (DeepSeek)
}

export interface AppearanceConfig {
  theme: 'dark' | 'light';
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  immersiveMode: boolean;
}

export interface AppSettings {
  ai?: AIConfig; // Legacy field for migration
  models?: ModelConfig[];
  defaultModelId?: string;
  appearance: AppearanceConfig;
  genres?: string[]; // 新增：全局故事类型
  backgrounds?: string[]; // 新增：全局故事背景
}
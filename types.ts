
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

export interface IdeaProject {
  id: string;
  title: string;
  spark: string; // Stage 1: The core idea/trope
  worldview: string; // Stage 2: Generated world setting
  outline: string; // Stage 3a: Macro outline
  volumes?: Volume[]; // Stage 3b: Volume outlines
  chapterBeats: ChapterBeat[]; // Stage 4: Structured chapter plan
  beatsSplitHistory?: BeatsSplit[]; // 拆分历史记录
  lastSplitChapterNum?: number; // 上次拆分到的章节号
  linkedBookId?: string; // Associated Book ID
  updatedAt: number;
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
}
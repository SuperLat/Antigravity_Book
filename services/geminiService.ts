
import { GoogleGenAI } from "@google/genai";
import { Entity, Chapter, EntityType, AIConfig, ChapterBeat } from '../types';

// Default env key
const DEFAULT_API_KEY = process.env.API_KEY || '';

let aiClient: GoogleGenAI | null = null;
let currentKey: string | null = null;

export const initializeGemini = (apiKey?: string) => {
  const keyToUse = apiKey || DEFAULT_API_KEY;
  if (keyToUse && keyToUse !== currentKey) {
    aiClient = new GoogleGenAI({ apiKey: keyToUse });
    currentKey = keyToUse;
  }
};

interface GenerationParams {
  aiConfig: AIConfig;
  userPrompt: string;
  selectedEntities: Entity[];
  selectedChapters: Chapter[];
  activeChapter: Chapter;
  previousChapterSummary?: string;
}

const getTypeLabel = (type: EntityType) => {
  switch (type) {
    case EntityType.CHARACTER: return '角色设定';
    case EntityType.WORLDVIEW: return '世界观设定';
    case EntityType.PLOT: return '剧情大纲';
    case EntityType.IDEA: return '灵感/脑洞';
    default: return '设定';
  }
}

export const generateNovelContent = async ({
  aiConfig,
  userPrompt,
  selectedEntities,
  selectedChapters,
  activeChapter,
  previousChapterSummary
}: GenerationParams): Promise<string> => {

  // Initialize with user provided key or fallback
  initializeGemini(aiConfig.apiKey);

  if (!aiClient) throw new Error("API Key missing. Please configure it in Settings or use the default environment.");

  // 1. Construct the System Context from selected Wiki items
  const contextBlock = selectedEntities.map(e =>
    `【${getTypeLabel(e.type)} - ${e.name}】\n简介：${e.description}\n详细内容：${e.content}`
  ).join('\n\n');

  // 1.5 Construct Context from selected Chapters
  const chapterBlock = selectedChapters.map(c =>
    `【参考章节 - ${c.title}】\n${c.content}`
  ).join('\n\n');

  // 2. Construct Writing Context (Current Story State)
  const storyContext = `
    【前情提要】: ${previousChapterSummary || "暂无"}
    【当前章节内容 (参考)】: 
    ${activeChapter.content.slice(-aiConfig.contextWindow)} 
    ... (以上为当前正文末尾)
  `;

  // 3. Final Prompt Assembly
  const finalPrompt = `
    ${contextBlock ? `--- 关联的知识库 (Wiki) ---\n${contextBlock}\n------------------------------` : ''}
    
    ${chapterBlock ? `--- 关联的章节 (Chapters) ---\n${chapterBlock}\n------------------------------` : ''}

    ${storyContext}

    --- 你的任务 ---
    ${userPrompt}
  `;

  try {
    const response = await aiClient.models.generateContent({
      model: aiConfig.modelName || 'gemini-2.5-flash',
      contents: finalPrompt,
      config: {
        systemInstruction: "你是一位专业的小说家助手。你的目标是基于提供的世界观和角色设定，辅助用户进行小说创作、扩写或润色。请务必保持现有文本的风格和语气。所有输出默认使用中文。",
        temperature: aiConfig.temperature,
        maxOutputTokens: aiConfig.maxTokens,
      }
    });

    return response.text || "未能生成内容。";
  } catch (error) {
    console.error("AI Generation Error:", error);
    return `生成内容时出错: ${(error as Error).message}`;
  }
};

export const generateWorldviewFromIdea = async (
  aiConfig: AIConfig,
  ideaContent: string,
  customTemplate?: string
): Promise<string> => {
  initializeGemini(aiConfig.apiKey);
  if (!aiClient) throw new Error("API Key missing.");

  let finalPrompt = '';

  if (customTemplate) {
    // Variable Injection
    finalPrompt = customTemplate
      .replace(/{{input}}/g, ideaContent)
      .replace(/{{spark}}/g, ideaContent);
  } else {
    // Default Logic
    finalPrompt = `
      核心梗/脑洞：【${ideaContent}】
      
      请基于上述核心梗，设计一个详细的世界观。
      
      要求包含以下内容：
      1. 力量体系名称及等级划分。
      2. 社会结构与核心阶层矛盾。
      3. 核心能源或驱动力是什么。
      4. 独特的地理环境或城市风貌。
      
      请使用结构清晰的 Markdown 格式输出。
    `;
  }

  try {
    const response = await aiClient.models.generateContent({
      model: aiConfig.modelName || 'gemini-2.5-flash',
      contents: finalPrompt,
      config: {
        systemInstruction: "你是一个想象力丰富的世界架构师。请根据用户的灵感碎片构建宏大且逻辑自洽的小说世界观。",
        temperature: 0.9,
        maxOutputTokens: 2048,
      }
    });
    return response.text || "未能生成世界观。";
  } catch (error) {
    throw new Error(`生成失败: ${(error as Error).message}`);
  }
};

export const generateOutlineFromWorldview = async (
  aiConfig: AIConfig,
  worldview: string,
  spark: string,
  customTemplate?: string
): Promise<string> => {
  initializeGemini(aiConfig.apiKey);
  if (!aiClient) throw new Error("API Key missing.");

  let finalPrompt = '';

  if (customTemplate) {
    finalPrompt = customTemplate
      .replace(/{{worldview}}/g, worldview)
      .replace(/{{spark}}/g, spark)
      .replace(/{{input}}/g, spark);
  } else {
    finalPrompt = `
      【核心梗】：${spark}
      【世界观设定】：${worldview}

      请基于以上设定，设计一个标准的三幕式小说大纲。
      要求：
      1. 主角背景设定（底层贫民/意外卷入者等）。
      2. 每一幕（第一卷、第二卷、第三卷）的核心冲突和高潮点。
      3. 结局的初步构想。
      
      请用 Markdown 格式输出。
    `;
  }

  try {
    const response = await aiClient.models.generateContent({
      model: aiConfig.modelName || 'gemini-2.5-flash',
      contents: finalPrompt,
      config: {
        systemInstruction: "你是一个擅长构建剧情结构的小说主编。请设计情节紧凑、冲突激烈的大纲。",
        temperature: 0.7,
      }
    });
    return response.text || "未能生成大纲。";
  } catch (error) {
    throw new Error(`生成大纲失败: ${(error as Error).message}`);
  }
};

export const generateChapterBeatsFromOutline = async (
  aiConfig: AIConfig,
  outline: string,
  customTemplate?: string
): Promise<ChapterBeat[]> => {
  initializeGemini(aiConfig.apiKey);
  if (!aiClient) throw new Error("API Key missing.");

  let promptContent = '';

  if (customTemplate) {
    promptContent = customTemplate
      .replace(/{{outline}}/g, outline)
      .replace(/{{input}}/g, outline);
  } else {
    promptContent = `
      【小说大纲】：${outline}

      请基于大纲的第一部分（第一卷），拆分为 5-8 个具体的章节细纲。
    `;
  }

  // Force JSON instruction at the end to ensure parser works even with custom templates
  const finalPrompt = `
    ${promptContent}
    
    IMPORTANT:
    请严格返回 JSON 格式，数组结构，不要包含 markdown 代码块标记。格式如下：
    [
      {
        "chapterTitle": "第一章：...",
        "summary": "本章发生的具体事件摘要...",
        "keyCharacters": ["主角名", "配角名"],
        "conflict": "核心冲突点"
      }
    ]
  `;

  try {
    const response = await aiClient.models.generateContent({
      model: aiConfig.modelName || 'gemini-2.5-flash',
      contents: finalPrompt,
      config: {
        systemInstruction: "你是一个精通网文节奏的策划。请将大纲拆解为具象化的章节细纲。仅返回纯 JSON 数据。",
        temperature: 0.6,
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "[]";
    // Clean up potential markdown code blocks if the model ignores the instruction
    const jsonStr = text.replace(/```json\n?|\n?```/g, '');
    return JSON.parse(jsonStr) as ChapterBeat[];
  } catch (error) {
    console.error("JSON Parse Error or AI Error", error);
    throw new Error("生成细纲失败或格式解析错误。");
  }
};

import { GoogleGenAI } from "@google/genai";
import { Entity, Chapter, EntityType, ModelConfig, ChapterBeat, BeatsSplit } from '../types';

// Default env key
const DEFAULT_API_KEY = process.env.API_KEY || '';

let geminiClient: GoogleGenAI | null = null;
let currentGeminiKey: string | null = null;

const initializeGemini = (apiKey?: string) => {
  const keyToUse = apiKey || DEFAULT_API_KEY;
  if (keyToUse && keyToUse !== currentGeminiKey) {
    geminiClient = new GoogleGenAI({ apiKey: keyToUse });
    currentGeminiKey = keyToUse;
  }
};

// Retry utility with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
  backoff = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    // Check for 429 (Too Many Requests) or 503 (Service Unavailable)
    const isRateLimit = error.status === 429 ||
      (error.message && error.message.includes('429')) ||
      (error.message && error.message.includes('RESOURCE_EXHAUSTED'));

    if (retries > 0 && isRateLimit) {
      console.warn(`⚠️ API Rate Limit hit. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * backoff, backoff);
    }

    if (isRateLimit) {
      throw new Error('API 调用次数超限，已重试多次无效。请检查您的 API 配额或稍后再试。');
    }
    throw error;
  }
}

// OpenAI-compatible API call (for DeepSeek, OpenAI, etc.)
const callOpenAICompatible = async (
  modelConfig: ModelConfig,
  messages: Array<{ role: string; content: string }>,
  systemInstruction?: string
): Promise<string> => {
  // Use proxy for CORS issues
  let baseUrl = modelConfig.baseUrl || '';
  let useBackendProxy = false;

  // If no custom URL, use proxy
  if (!baseUrl) {
    if (modelConfig.provider === 'openai') {
      baseUrl = '/api/openai/v1';
    } else if (modelConfig.provider === 'custom') {
      baseUrl = '/api/deepseek';
    } else if (modelConfig.provider === 'gemini') {
      baseUrl = '/v1beta/openai/';
    }
  } else {
    // If it's a custom absolute URL, use our backend proxy
    if (baseUrl.startsWith('http')) {
      useBackendProxy = true;
    }
  }

  const requestBody: any = {
    model: modelConfig.modelName,
    messages: systemInstruction
      ? [{ role: 'system', content: systemInstruction }, ...messages]
      : messages,
    temperature: modelConfig.temperature,
    max_tokens: modelConfig.maxTokens,
  };

  // --- 火山引擎/DeepSeek 特有配置开关 ---
  // 使用前端传入的配置，默认为 false (disabled)
  const ENABLE_DEEPSEEK_THINKING = modelConfig.enableThinking ?? false; 

  // 检测是否为 DeepSeek 系列模型 (兼容 deekseep 拼写)
  const isDeepSeek = /deepseek|deekseep/i.test(modelConfig.modelName);

  if (isDeepSeek) {
    // 火山引擎特定参数: 控制思考模式
    requestBody.thinking = {
      type: ENABLE_DEEPSEEK_THINKING ? "enabled" : "disabled"
    };
    console.log(`🧠 DeepSeek 思考模式: ${ENABLE_DEEPSEEK_THINKING ? '已启用' : '已禁用'}`);
  }
  // ------------------------------------

  console.log('🚀 API 请求:', {
    url: useBackendProxy ? '/api/proxy' : `${baseUrl}/chat/completions`,
    targetUrl: useBackendProxy ? `${baseUrl}/chat/completions` : undefined,
    provider: modelConfig.provider,
    model: modelConfig.modelName,
  });

  try {
    const fetchUrl = useBackendProxy ? '/api/proxy' : `${baseUrl}/chat/completions`;
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${modelConfig.apiKey}`,
      },
      body: JSON.stringify(useBackendProxy ? {
        targetUrl: `${baseUrl}/chat/completions`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${modelConfig.apiKey.trim()}`,
        },
        body: requestBody
      } : requestBody),
    };

    const response = await retryWithBackoff(() => fetch(fetchUrl, fetchOptions));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API 错误响应:', errorText);
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('✅ API 响应成功');
    return data.choices[0]?.message?.content || '未能生成内容。';
  } catch (error: any) {
    console.error('❌ API 调用失败:', error);
    if (error.message === 'Failed to fetch') {
      throw new Error('网络请求失败。请检查：\n1. API Key 是否正确\n2. 网络连接是否正常\n3. API 服务是否可用');
    }
    throw error;
  }
};

// Test model configuration
export const testModelConfig = async (modelConfig: ModelConfig): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('🧪 测试模型配置:', modelConfig.name);

    if (modelConfig.provider === 'gemini') {
      initializeGemini(modelConfig.apiKey);
      if (!geminiClient) {
        return { success: false, message: 'API Key 未配置' };
      }

      const response = await retryWithBackoff(() => geminiClient!.models.generateContent({
        model: modelConfig.modelName || 'gemini-2.5-flash',
        contents: '请回复"测试成功"',
        config: {
          temperature: 0.1,
          maxOutputTokens: 50,
        }
      }));

      const result = response.text || '';
      return {
        success: true,
        message: `✅ 连接成功！\n模型响应: ${result.substring(0, 50)}${result.length > 50 ? '...' : ''}`
      };
    } else {
      const result = await retryWithBackoff(() => callOpenAICompatible(
        modelConfig,
        [{ role: 'user', content: '请回复"测试成功"' }],
        '你是一个测试助手，请简短回复。'
      ));

      return {
        success: true,
        message: `✅ 连接成功！\n模型响应: ${result.substring(0, 50)}${result.length > 50 ? '...' : ''}`
      };
    }
  } catch (error: any) {
    console.error('❌ 测试失败:', error);
    return {
      success: false,
      message: `❌ 测试失败\n错误: ${error.message}`
    };
  }
};

export const generateVolumesFromOutline = async (
  config: ModelConfig,
  outline: string,
  customTemplate?: string
): Promise<{ title: string; summary: string }[]> => {
  const prompt = customTemplate
    ? customTemplate.replace('{{context}}', outline)
    : `
作为一名资深网文策划，请根据以下全书大纲，将其拆分为 3-5 个具体的“卷”（Volume）。
每一卷应该有一个明确的主题或阶段性目标，并包含该卷的详细剧情摘要。

全书大纲：
${outline}

请以 JSON 数组格式返回，格式如下：
[
  {
    "title": "第一卷：卷名",
    "summary": "本卷的详细剧情摘要，包括主要冲突、高潮和结局..."
  },
  ...
]
只返回 JSON 数据，不要包含 markdown 标记或其他文本。
`;

  const systemInstruction = "你是一个专业的小说策划师。请根据用户提供的大纲，将其拆分为多个分卷。";

  try {
    let text = '';
    if (config.provider === 'gemini') {
      initializeGemini(config.apiKey);
      if (!geminiClient) throw new Error("API Key missing.");

      const response = await retryWithBackoff(() => geminiClient!.models.generateContent({
        model: config.modelName || 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.8,
          maxOutputTokens: 4096,
        }
      }));
      text = response.text || "";
    } else {
      text = await retryWithBackoff(() => callOpenAICompatible(
        config,
        [{ role: 'user', content: prompt }],
        systemInstruction
      ));
    }

    try {
      const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse volumes JSON", text);
      throw new Error("AI 返回格式错误，无法解析分卷数据。");
    }
  } catch (error) {
    throw new Error(`生成分卷失败: ${(error as Error).message}`);
  }
};

export const generatePartsFromVolume = async (
  config: ModelConfig,
  volumeTitle: string,
  volumeSummary: string,
  customTemplate?: string
): Promise<{ title: string; summary: string }[]> => {
  const prompt = customTemplate
    ? customTemplate.replace('{{volumeTitle}}', volumeTitle).replace('{{volumeSummary}}', volumeSummary)
    : `
作为一名资深网文策划，请根据以下卷大纲，将其拆分为 2-4 个"分部"（Part）。
每个分部应该是该卷内的一个阶段性剧情单元，有明确的起承转合。

卷标题：${volumeTitle}
卷大纲：
${volumeSummary}

请以 JSON 数组格式返回，格式如下：
[
  {
    "title": "第一部：分部名",
    "summary": "本分部的详细剧情摘要..."
  },
  ...
]
只返回 JSON 数据，不要包含 markdown 标记或其他文本。
`;

  const systemInstruction = "你是一个专业的小说策划师。请根据用户提供的卷大纲，将其拆分为多个分部。";

  try {
    let text = '';
    if (config.provider === 'gemini') {
      initializeGemini(config.apiKey);
      if (!geminiClient) throw new Error("API Key missing.");

      const response = await retryWithBackoff(() => geminiClient!.models.generateContent({
        model: config.modelName || 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.8,
          maxOutputTokens: 4096,
        }
      }));
      text = response.text || "";
    } else {
      text = await retryWithBackoff(() => callOpenAICompatible(
        config,
        [{ role: 'user', content: prompt }],
        systemInstruction
      ));
    }

    try {
      const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse parts JSON", text);
      throw new Error("AI 返回格式错误，无法解析分部数据。");
    }
  } catch (error) {
    throw new Error(`生成分部失败: ${(error as Error).message}`);
  }
};

// Generate chapter summary
export const generateChapterSummary = async (
  modelConfig: ModelConfig,
  chapterContent: string,
  customTemplate?: string
): Promise<string> => {
  let finalPrompt = '';

  if (customTemplate) {
    finalPrompt = customTemplate
      .replace(/{{content}}/g, chapterContent)
      .replace(/{{input}}/g, chapterContent);
  } else {
    finalPrompt = `
      请为以下章节内容生成一个简洁的概要（100-200字）：

      【章节内容】
      ${chapterContent}

      要求：
      1. 概括本章的核心事件和情节发展
      2. 提及关键角色和他们的行动
      3. 突出本章的冲突或转折点
      4. 简明扼要，便于后续章节参考

      请直接输出概要内容，不要包含其他说明。
    `;
  }

  const systemInstruction = "你是一个专业的小说编辑。请为章节内容生成精炼的概要，帮助作者把握故事脉络。";

  try {
    if (modelConfig.provider === 'gemini') {
      initializeGemini(modelConfig.apiKey);
      if (!geminiClient) throw new Error("API Key missing.");

      const response = await retryWithBackoff(() => geminiClient!.models.generateContent({
        model: modelConfig.modelName || 'gemini-2.5-flash',
        contents: finalPrompt,
        config: {
          systemInstruction,
          temperature: 0.5,
          maxOutputTokens: 500,
        }
      }));
      return response.text || "未能生成概要。";
    } else {
      return await callOpenAICompatible(
        modelConfig,
        [{ role: 'user', content: finalPrompt }],
        systemInstruction
      );
    }
  } catch (error) {
    throw new Error(`生成概要失败: ${(error as Error).message}`);
  }
};

interface GenerationParams {
  modelConfig: ModelConfig;
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
  modelConfig,
  userPrompt,
  selectedEntities,
  selectedChapters,
  activeChapter,
  previousChapterSummary
}: GenerationParams): Promise<string> => {

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
    ${activeChapter.content.slice(-modelConfig.contextWindow)} 
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

  const systemInstruction = "你是一位专业的小说家助手。你的目标是基于提供的世界观和角色设定，辅助用户进行小说创作、扩写或润色。请务必保持现有文本的风格和语气。所有输出默认使用中文。";

  try {
    // Route to different providers
    if (modelConfig.provider === 'gemini') {
      initializeGemini(modelConfig.apiKey);
      if (!geminiClient) throw new Error("API Key missing. Please configure it in Settings.");

      const response = await retryWithBackoff(() => geminiClient!.models.generateContent({
        model: modelConfig.modelName || 'gemini-2.5-flash',
        contents: finalPrompt,
        config: {
          systemInstruction,
          temperature: modelConfig.temperature,
          maxOutputTokens: modelConfig.maxTokens,
        }
      }));
      return response.text || "未能生成内容。";
    } else if (modelConfig.provider === 'openai' || modelConfig.provider === 'custom') {
      return await callOpenAICompatible(
        modelConfig,
        [{ role: 'user', content: finalPrompt }],
        systemInstruction
      );
    } else if (modelConfig.provider === 'ollama') {
      // Ollama uses OpenAI-compatible API
      return await callOpenAICompatible(
        { ...modelConfig, baseUrl: modelConfig.baseUrl || 'http://localhost:11434/v1' },
        [{ role: 'user', content: finalPrompt }],
        systemInstruction
      );
    } else {
      throw new Error(`不支持的提供商: ${modelConfig.provider}`);
    }
  } catch (error) {
    console.error("AI Generation Error:", error);
    return `生成内容时出错: ${(error as Error).message}`;
  }
};

export const generateStorylineFromIdea = async (
  modelConfig: ModelConfig,
  spark: string,
  customTemplate?: string
): Promise<string> => {
  let finalPrompt = '';

  if (customTemplate) {
    finalPrompt = customTemplate
      .replace(/{{input}}/g, spark)
      .replace(/{{spark}}/g, spark);
  } else {
    finalPrompt = `
      【核心梗/脑洞】：${spark}
      
      请基于这个核心脑洞，梳理出一条清晰、完整的故事线（Storyline）。
      
      要求：
      1. 明确故事的主角及其核心目标。
      2. 概括故事的起因、经过和结果（Start, Middle, End）。
      3. 包含关键的转折点和高潮事件。
      4. 既然是故事线，请注重逻辑连贯性，字数控制在 500-800 字左右。
      
      请直接输出故事线内容。
    `;
  }

  const systemInstruction = "你是一个擅长梳理故事脉络的小说策划。请将用户的碎片化脑洞转化为连贯的故事线。";

  try {
    if (modelConfig.provider === 'gemini') {
      initializeGemini(modelConfig.apiKey);
      if (!geminiClient) throw new Error("API Key missing.");

      const response = await retryWithBackoff(() => geminiClient!.models.generateContent({
        model: modelConfig.modelName || 'gemini-2.5-flash',
        contents: finalPrompt,
        config: {
          systemInstruction,
          temperature: 0.8,
          maxOutputTokens: 2048,
        }
      }));
      return response.text || "未能生成故事线。";
    } else {
      return await callOpenAICompatible(
        modelConfig,
        [{ role: 'user', content: finalPrompt }],
        systemInstruction
      );
    }
  } catch (error) {
    throw new Error(`生成故事线失败: ${(error as Error).message}`);
  }
};

export const generateOutlineFromStoryline = async (
  modelConfig: ModelConfig,
  storyline: string,
  customTemplate?: string
): Promise<string> => {
  let finalPrompt = '';

  if (customTemplate) {
    finalPrompt = customTemplate
      .replace(/{{storyline}}/g, storyline)
      .replace(/{{input}}/g, storyline);
  } else {
    finalPrompt = `
      【故事线】：
      ${storyline}

      请基于以上故事线，设计一个标准的网文大纲（三幕式或多卷式）。
      要求：
      1. 主角人设简述（基于故事线推导）。
      2. 详细规划每一幕/卷的核心冲突、关键剧情点和爽点。
      3. 结局设计。
      
      请用 Markdown 格式输出，结构清晰。
    `;
  }

  const systemInstruction = "你是一个擅长构建剧情结构的小说主编。请根据故事线，设计情节紧凑、冲突激烈的大纲。";

  try {
    if (modelConfig.provider === 'gemini') {
      initializeGemini(modelConfig.apiKey);
      if (!geminiClient) throw new Error("API Key missing.");

      const response = await retryWithBackoff(() => geminiClient!.models.generateContent({
        model: modelConfig.modelName || 'gemini-2.5-flash',
        contents: finalPrompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      }));
      return response.text || "未能生成大纲。";
    } else {
      return await callOpenAICompatible(
        modelConfig,
        [{ role: 'user', content: finalPrompt }],
        systemInstruction
      );
    }
  } catch (error) {
    throw new Error(`生成大纲失败: ${(error as Error).message}`);
  }
};

export const generateWorldviewFromIdea = async (
  modelConfig: ModelConfig,
  ideaContent: string,
  customTemplate?: string
): Promise<string> => {
  let finalPrompt = '';

  if (customTemplate) {
    finalPrompt = customTemplate
      .replace(/{{input}}/g, ideaContent)
      .replace(/{{spark}}/g, ideaContent);
  } else {
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

  const systemInstruction = "你是一个想象力丰富的世界架构师。请根据用户的灵感碎片构建宏大且逻辑自洽的小说世界观。";

  try {
    if (modelConfig.provider === 'gemini') {
      initializeGemini(modelConfig.apiKey);
      if (!geminiClient) throw new Error("API Key missing.");

      const response = await retryWithBackoff(() => geminiClient!.models.generateContent({
        model: modelConfig.modelName || 'gemini-2.5-flash',
        contents: finalPrompt,
        config: {
          systemInstruction,
          temperature: 0.9,
          maxOutputTokens: 2048,
        }
      }));
      return response.text || "未能生成世界观。";
    } else {
      return await callOpenAICompatible(
        modelConfig,
        [{ role: 'user', content: finalPrompt }],
        systemInstruction
      );
    }
  } catch (error) {
    throw new Error(`生成失败: ${(error as Error).message}`);
  }
};

export const generateOutlineFromWorldview = async (
  modelConfig: ModelConfig,
  worldview: string,
  spark: string,
  customTemplate?: string
): Promise<string> => {
  let finalPrompt = '';

  if (customTemplate) {
    finalPrompt = customTemplate
      .replace(/{{worldview}}/g, worldview || "（暂无详细设定，请根据核心梗自由发挥）")
      .replace(/{{spark}}/g, spark)
      .replace(/{{input}}/g, spark);
  } else {
    // 动态构建 Prompt，如果 worldview 为空则不强调它
    const worldviewSection = worldview ? `【世界观设定】：${worldview}` : '';
    
    finalPrompt = `
      【核心梗】：${spark}
      ${worldviewSection}

      请基于以上信息，设计一个标准的三幕式小说大纲。
      要求：
      1. 主角背景设定（底层贫民/意外卷入者等）。
      2. 每一幕（第一卷、第二卷、第三卷）的核心冲突和高潮点。
      3. 结局的初步构想。
      
      请用 Markdown 格式输出。
    `;
  }

  const systemInstruction = "你是一个擅长构建剧情结构的小说主编。请设计情节紧凑、冲突激烈的大纲。";

  try {
    if (modelConfig.provider === 'gemini') {
      initializeGemini(modelConfig.apiKey);
      if (!geminiClient) throw new Error("API Key missing.");

      const response = await retryWithBackoff(() => geminiClient!.models.generateContent({
        model: modelConfig.modelName || 'gemini-2.5-flash',
        contents: finalPrompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      }));
      return response.text || "未能生成大纲。";
    } else {
      return await callOpenAICompatible(
        modelConfig,
        [{ role: 'user', content: finalPrompt }],
        systemInstruction
      );
    }
  } catch (error) {
    throw new Error(`生成大纲失败: ${(error as Error).message}`);
  }
};

export const generateChapterBeatsFromOutline = async (
  modelConfig: ModelConfig,
  outline: string,
  customTemplate?: string
): Promise<ChapterBeat[]> => {
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

  const systemInstruction = "你是一个精通网文节奏的策划。请将大纲拆解为具象化的章节细纲。仅返回纯 JSON 数据。";

  try {
    let text = '';

    if (modelConfig.provider === 'gemini') {
      initializeGemini(modelConfig.apiKey);
      if (!geminiClient) throw new Error("API Key missing.");

      const response = await retryWithBackoff(() => geminiClient!.models.generateContent({
        model: modelConfig.modelName || 'gemini-2.5-flash',
        contents: finalPrompt,
        config: {
          systemInstruction,
          temperature: 0.6,
          responseMimeType: "application/json"
        }
      }));
      text = response.text || "[]";
    } else {
      const result = await callOpenAICompatible(
        modelConfig,
        [{ role: 'user', content: finalPrompt }],
        systemInstruction
      );
      text = result;
    }

    // Clean up potential markdown code blocks
    const jsonStr = text.replace(/```json\n?|\n?```/g, '');
    return JSON.parse(jsonStr) as ChapterBeat[];
  } catch (error) {
    console.error("JSON Parse Error or AI Error", error);
    throw new Error("生成细纲失败或格式解析错误。");
  }
};

// 从卷内容拆分指定数量的章节细纲
export const generateBeatsFromVolumeContent = async (
  modelConfig: ModelConfig,
  volumeContent: string,
  chapterCount: number,
  startChapter: number,
  customTemplate?: string
): Promise<ChapterBeat[]> => {
  let promptContent = '';

  if (customTemplate) {
    promptContent = customTemplate
      .replace(/{{volumeContent}}/g, volumeContent)
      .replace(/{{input}}/g, volumeContent)
      .replace(/{{chapterCount}}/g, String(chapterCount))
      .replace(/{{startChapter}}/g, String(startChapter));
  } else {
    promptContent = `
      【卷大纲内容】：
      ${volumeContent}

      请将以上内容拆分为 ${chapterCount} 个连续的章节细纲。
      章节编号从第 ${startChapter} 章开始，到第 ${startChapter + chapterCount - 1} 章。
      
      要求：
      1. 每个章节要有具体的情节推进
      2. 章节之间要有连贯性
      3. 包含核心冲突和关键角色
    `;
  }

  const finalPrompt = `
    ${promptContent}
    
    IMPORTANT:
    请严格返回 JSON 格式，数组结构，不要包含 markdown 代码块标记。格式如下：
    [
      {
        "chapterTitle": "第${startChapter}章：...",
        "summary": "本章发生的具体事件摘要...",
        "keyCharacters": ["主角名", "配角名"],
        "conflict": "核心冲突点"
      }
    ]
    
    必须返回恰好 ${chapterCount} 个章节。
  `;

  const systemInstruction = "你是一个精通网文节奏的策划。请将大纲拆解为具象化的章节细纲。仅返回纯 JSON 数据。";

  try {
    let text = '';

    if (modelConfig.provider === 'gemini') {
      initializeGemini(modelConfig.apiKey);
      if (!geminiClient) throw new Error("API Key missing.");

      const response = await retryWithBackoff(() => geminiClient!.models.generateContent({
        model: modelConfig.modelName || 'gemini-2.5-flash',
        contents: finalPrompt,
        config: {
          systemInstruction,
          temperature: 0.6,
          responseMimeType: "application/json"
        }
      }));
      text = response.text || "[]";
    } else {
      const result = await callOpenAICompatible(
        modelConfig,
        [{ role: 'user', content: finalPrompt }],
        systemInstruction
      );
      text = result;
    }

    // Clean up potential markdown code blocks
    const jsonStr = text.replace(/```json\n?|\n?```/g, '');
    return JSON.parse(jsonStr) as ChapterBeat[];
  } catch (error) {
    console.error("JSON Parse Error or AI Error", error);
    throw new Error("生成细纲失败或格式解析错误。");
  }
};

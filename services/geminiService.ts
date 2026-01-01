import { GoogleGenAI } from "@google/genai";
import { Entity, Chapter, EntityType, ModelConfig, ChapterBeat, BeatsSplit, CharacterProfile } from '../types';

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
    // 只有在启用时才发送 thinking 参数，否则不发送（依赖默认关闭）
    if (ENABLE_DEEPSEEK_THINKING) {
      requestBody.thinking = {
        type: "enabled"
      };
    }
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

  // 1. Strict Regex Extraction (No AI)

  // We use local extraction to avoid Token limits and ensure exact fidelity to the outline.

  const volumes: { title: string; summary: string }[] = [];



  // Regex to match headers.

  // Supports:

  // - Markdown headers: #, ##, ###

  // - Plain text starts

  // - Patterns: "第x卷", "Volume x", "卷x"

  const headerRegex = /^\s*(?:#{1,6}\s*)?.*(?:第[0-9零一二三四五六七八九十百]+卷|Volume\s*\d+|卷[0-9零一二三四五六七八九十百]+).*$/gmi;



  const matches = [...outline.matchAll(headerRegex)];



  if (matches.length > 0) {

    for (let i = 0; i < matches.length; i++) {

      const match = matches[i];

      // Clean up title (remove leading hashes and whitespace)

      const title = match[0].replace(/^[#\s]+/, '').trim();



      const startIndex = match.index! + match[0].length;

      const endIndex = (i < matches.length - 1) ? matches[i + 1].index! : outline.length;



      const summary = outline.substring(startIndex, endIndex).trim();



      if (title) {

        volumes.push({ title, summary });

      }

    }

  }



  if (volumes.length === 0) {

    console.warn("No volumes found via Regex extraction in outline:", outline.substring(0, 100));

    throw new Error("无法从大纲中提取分卷信息。\n\n请确保大纲包含清晰的分卷标题，例如：\n“### 第一卷：风起云涌”\n“# 卷一 初始”\n“Volume 1: The Beginning”");

  }



  console.log(`✅ Successfully extracted ${volumes.length} volumes via Regex.`);

  return volumes;

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

  // 1.5 Construct Context from selected Chapters (Limit content length to avoid token overflow)
  const chapterBlock = selectedChapters.map(c => {
    // Take the last 3000 characters of the referenced chapter to keep context relevant but manageable
    const contentPreview = c.content.length > 3000
      ? `...(前文省略)\n${c.content.slice(-3000)}`
      : c.content;
    return `【参考章节 - ${c.title}】\n${contentPreview}`;
  }).join('\n\n');

  // 2. Construct Writing Context (Current Story State)
  // Increase context window for current chapter to ensure continuity
  const storyContext = `
    【前情提要】: ${previousChapterSummary || "暂无"}
    【当前章节内容 (续写起点)】: 
    ${activeChapter.content.slice(-3000)} 
    ... (以上为当前正文末尾)
  `;

  // 3. Final Prompt Assembly
  const finalPrompt = `
    ${contextBlock ? `--- 关联的知识库 (Wiki) ---\n${contextBlock}\n------------------------------` : ''}
    
    ${chapterBlock ? `--- 关联的章节 (前文参考) ---\n${chapterBlock}\n------------------------------` : ''}

    ${storyContext}

    --- 你的任务 ---
    ${userPrompt}
    
    (请继续撰写正文，保持风格一致，情节连贯。)
  `;

  const systemInstruction = "你是一位专业的小说家助手。你的目标是基于提供的世界观、角色设定和前文章节，辅助用户进行小说创作、扩写或润色。请务必保持现有文本的风格和语气。所有输出默认使用中文。";

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
          maxOutputTokens: Math.max(modelConfig.maxTokens || 2048, 4096), // Ensure sufficient output tokens for writing
        }
      }));
      return response.text || "未能生成内容。";
    } else if (modelConfig.provider === 'openai' || modelConfig.provider === 'custom') {
      return await callOpenAICompatible(
        { ...modelConfig, maxTokens: Math.max(modelConfig.maxTokens || 2048, 4096) }, // Override maxTokens locally
        [{ role: 'user', content: finalPrompt }],
        systemInstruction
      );
    } else if (modelConfig.provider === 'ollama') {
      // Ollama uses OpenAI-compatible API
      return await callOpenAICompatible(
        { ...modelConfig, baseUrl: modelConfig.baseUrl || 'http://localhost:11434/v1', maxTokens: Math.max(modelConfig.maxTokens || 2048, 4096) },
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

// Helper to extract JSON from AI response
const extractJson = (text: string): string => {
  // 1. Try to find content within ```json ... ``` blocks
  const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (markdownMatch && markdownMatch[1]) {
    return markdownMatch[1].trim();
  }

  // 2. Try to find the first '{' and last '}'
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    return braceMatch[0].trim();
  }

  return text.trim();
};

export const generateStoryCoreAndSynopsis = async (
  modelConfig: ModelConfig,
  spark: string,
  options?: {
    length?: string;
    genre?: string;
    background?: string;
  },
  customTemplate?: string
): Promise<{ core: string; synopsis: string }> => {
  let finalPrompt = '';

  const optionsText = `
${options?.length ? `- 篇幅期望：${options.length === 'long' ? '长篇小说' : '短篇故事'}` : ''}
${options?.genre ? `- 故事类型：${options.genre}` : ''}
${options?.background ? `- 故事背景：${options.background}` : ''}
  `.trim();

  if (customTemplate) {
    finalPrompt = customTemplate
      .replace(/{{input}}/g, spark)
      .replace(/{{spark}}/g, spark)
      .replace(/{{options}}/g, optionsText);
  } else {
    finalPrompt = `
      【核心脑洞/灵感】：${spark}
      ${optionsText ? `\n【创作设定】：\n${optionsText}\n` : ''}
      
      请基于以上信息，提炼出故事内核（Story Core）并撰写一个故事概要（Story Synopsis）。
      
      要求：
      1. 故事内核：用一句话或简短的几句话描述故事最深层的哲学内涵、情感核心或最本质的冲突。
      2. 故事概要：约 300-500 字，包含背景设定、主角动机、核心危机以及大致的发展方向。
      
      请严格以 JSON 格式返回，不要包含任何 markdown 代码块标记，格式如下：
      {
        "core": "故事内核内容...",
        "synopsis": "故事概要内容..."
      }
    `;
  }

  const systemInstruction = "你是一个擅长提炼故事灵魂和架构大纲的小说策划。请务必只返回 JSON 数据，确保格式正确。";

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
          temperature: 0.8,
          maxOutputTokens: 2048,
          responseMimeType: "application/json"
        }
      }));

      // Handle both property and method access for text
      text = typeof (response as any).text === 'function' ? (response as any).text() : ((response as any).text || "");
    } else {
      text = await retryWithBackoff(() => callOpenAICompatible(
        modelConfig,
        [{ role: 'user', content: finalPrompt }],
        systemInstruction
      ));
    }

    console.log("AI Raw Response:", text);

    try {
      const jsonStr = extractJson(text);
      const data = JSON.parse(jsonStr);

      // Map potential different key names
      return {
        core: data.core || data.storyCore || data.story_core || data.内核 || "",
        synopsis: data.synopsis || data.storySynopsis || data.story_synopsis || data.概要 || ""
      };
    } catch (e) {
      console.error("Failed to parse core and synopsis JSON. Raw text:", text);
      throw new Error("AI 返回格式错误，无法解析数据。请检查控制台输出的原始响应。");
    }
  } catch (error) {
    throw new Error(`生成故事内核与概要失败: ${(error as Error).message}`);
  }
};

export const generateStorylineFromIdea = async (
  modelConfig: ModelConfig,
  spark: string,
  core?: string,
  synopsis?: string,
  customTemplate?: string
): Promise<string> => {
  let finalPrompt = '';

  if (customTemplate) {
    finalPrompt = customTemplate
      .replace(/{{input}}/g, spark)
      .replace(/{{spark}}/g, spark)
      .replace(/{{core}}/g, core || '')
      .replace(/{{synopsis}}/g, synopsis || '');
  } else {
    finalPrompt = `
      【原始灵感】：${spark}
      ${core ? `【故事内核】：${core}` : ''}
      ${synopsis ? `【故事概要】：${synopsis}` : ''}
      
      请基于以上信息，梳理出一条清晰、完整的故事线（Storyline）。
      
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
      
      请基于上述核心梗，设计一个精炼的世界观草案。
      
      要求包含以下内容（请保持简明扼要）：
      1. 力量体系名称及等级划分。
      2. 社会结构与核心阶层矛盾。
      3. 核心能源或驱动力是什么。
      4. 独特的地理环境或城市风貌。
      
      请使用结构清晰的 Markdown 格式输出。
    `;
  }

  const systemInstruction = "你是一个想象力丰富的世界架构师。请根据用户的灵感碎片构建逻辑自洽且精炼的小说世界观。";

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
      return typeof (response as any).text === 'function' ? (response as any).text() : ((response as any).text || "");
    } else {
      return await callOpenAICompatible(modelConfig, [{ role: 'user', content: finalPrompt }], systemInstruction);
    }
  } catch (error) {
    throw new Error(`生成失败: ${(error as Error).message}`);
  }
};

export const generateDetailedWorldview = async (
  modelConfig: ModelConfig,
  context: {
    storyLength?: string;
    core?: string;
    synopsis?: string;
    genre?: string;
    background?: string;
  },
  customTemplate?: string
): Promise<string> => {
  const lengthLabel = context.storyLength === 'short' ? '短篇故事' : '长篇小说';

  const prompt = customTemplate
    ? customTemplate.replace('{{storyLength}}', lengthLabel)
    : `
      基于以下故事信息，设计一个精炼且逻辑自洽的世界观背景。
      
      【故事篇幅】：${lengthLabel}
      【故事内核】：${context.core || '未设定'}
      【故事概要】：${context.synopsis || '未设定'}
      【初步设定】：类型：${context.genre || '未指定'}，基础背景：${context.background || '未指定'}
      
      要求包含以下内容（请保持简明扼要，避免冗长）：
      1. 世界背景：简述故事发生的空间设定。
      2. 力量/技术体系：概括核心逻辑（如修仙等级、科技水平、魔法法则等）。
      3. 核心冲突源：点出导致故事发生的深层诱因。
      
      请使用结构清晰的 Markdown 格式输出，重点在于核心设定的构建，非核心细节可适当留白。
    `;

  const systemInstruction = "你是一个想象力丰富且逻辑严密的世界架构师。请为小说构建逻辑自洽且精炼的世界观。";

  try {
    if (modelConfig.provider === 'gemini') {
      initializeGemini(modelConfig.apiKey);
      if (!geminiClient) throw new Error("API Key missing.");

      const response = await retryWithBackoff(() => geminiClient!.models.generateContent({
        model: modelConfig.modelName || 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.9,
          maxOutputTokens: 2048,
        }
      }));
      return typeof (response as any).text === 'function' ? (response as any).text() : ((response as any).text || "");
    } else {
      return await callOpenAICompatible(modelConfig, [{ role: 'user', content: prompt }], systemInstruction);
    }
  } catch (error) {
    throw new Error(`生成世界观失败: ${(error as Error).message}`);
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
        "chapterTitle": "第一章：具体标题",
        "summary": "第一章的具体事件摘要...",
        "keyCharacters": ["主角名", "配角名"],
        "conflict": "核心冲突点"
      },
      {
        "chapterTitle": "第二章：具体标题",
        "summary": "第二章的具体事件摘要...",
        "keyCharacters": ["主角名", "配角名"],
        "conflict": "核心冲突点"
      }
    ]
  `;

  const systemInstruction = "你是一个精通网文节奏的策划。请将大纲拆解为具象化的章节细纲。仅返回纯 JSON 数据。请确保每一章的内容都是独特的，不要重复相同的大纲。";

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
          maxOutputTokens: 8192,
          responseMimeType: "application/json"
        }
      }));
      text = response.text || "[]";
    } else {
      const configWithHighTokens = { ...modelConfig, maxTokens: Math.max(modelConfig.maxTokens || 4096, 8192) };
      const result = await callOpenAICompatible(
        configWithHighTokens,
        [{ role: 'user', content: finalPrompt }],
        systemInstruction
      );
      text = result;
    }

    // Clean up potential markdown code blocks
    let jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();

    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }

    try {
      return JSON.parse(jsonStr) as ChapterBeat[];
    } catch (e) {
      console.error("JSON Parse Error. Raw:", text);
      throw new Error("AI 返回数据无法解析，请重试。");
    }
  } catch (error) {
    console.error("JSON Parse Error or AI Error", error);
    throw new Error("生成细纲失败或格式解析错误。");
  }
};

// 从卷内容拆分指定数量的章节细纲
export const generateBeatsFromVolumeContent = async (
  modelConfig: ModelConfig,
  context: {
    volumeContent: string;
    chapterCount: number;
    startChapter: number;
    spark?: string;
    core?: string;
    synopsis?: string;
    worldview?: string;
    characters?: CharacterProfile[];
    referenceContext?: string; // New: Context from reference chapters
  },
  customTemplate?: string
): Promise<ChapterBeat[]> => {
  let promptContent = '';

  const { volumeContent, chapterCount, startChapter, referenceContext } = context;

  // 优化角色数据展现，包含更多维度
  const optimizedCharacters = context.characters?.map(c =>
    `### ${c.name} (${c.role})\n- 性格: ${c.personality || '暂无'}\n- 简介: ${c.description || '暂无'}\n- 背景: ${c.background || '暂无'}`
  ).join('\n') || "暂无具体角色设定";

  const contextBlock = `
--- 故事基础设定 (核心) ---
【核心灵感】：${context.spark || '未提供'}
【故事内核】：${context.core || '未提供'}
【故事概要】：${context.synopsis || '未提供'}

--- 世界观设定 ---
${context.worldview ? context.worldview.slice(0, 2000) : '暂无详细设定'}

--- 核心角色阵容 ---
${optimizedCharacters}

${referenceContext ? `--- 前文剧情参考/承接上下文 ---\n${referenceContext}` : ''}
  `.trim();

  if (customTemplate) {
    promptContent = customTemplate
      .replace(/{{volumeContent}}/g, volumeContent)
      .replace(/{{input}}/g, volumeContent)
      .replace(/{{chapterCount}}/g, String(chapterCount))
      .replace(/{{startChapter}}/g, String(startChapter))
      .replace(/{{reference}}/g, referenceContext || '');
  } else {
    promptContent = `
      ${contextBlock}

      --- 待拆解的剧情文本 ---
      ${volumeContent}

      --- 任务核心指令 (CRITICAL) ---
      你当前的角色是资深网文架构师。请将上述【待拆解的剧情文本】拆分为 ${chapterCount} 个连续的章节细纲。
      
      【强制要求】：
      1. **设定一致性**：剧情逻辑、力量体系、人物行为模式必须 100% 符合上文提供的【世界观】和【角色阵容】设定，严禁逻辑相悖。
      2. **承接精准性**：如果存在【前文剧情参考】，请确保第 ${startChapter} 章与前文无缝衔接，人物状态必须连贯。
      3. **章节细化**：每一章需拆解为 5-6 个具体的对话场景，并规划合理的字数。
      4. **严禁合并**：必须返回恰好 ${chapterCount} 个章节（从第 ${startChapter} 章到第 ${startChapter + chapterCount - 1} 章）。
      5. **拒绝幻觉**：不要引入与已有世界观冲突的奇幻/科幻元素，不要随意更改角色性格。
    `;
  }

  const finalPrompt = `
    ${promptContent}
    
    --- 输出规范 ---
    请严格返回 JSON 数组格式，不要包含任何 markdown 代码块标记，格式如下：
    [
      {
        "chapterTitle": "第${startChapter}章：具体标题",
        "summary": "本章的具体事件摘要...",
        "keyCharacters": ["主角名", "配角名"],
        "conflict": "核心冲突点",
        "scenes": [
          {
             "sceneTitle": "场景一：场景名",
             "detail": "关键线索或冲突点描述...",
             "wordCount": "400字"
          },
          ...
        ]
      },
      ...
    ]
  `;

  const systemInstruction = `你是一个深耕网文创作的 AI 助手。你极其擅长逻辑推演和细节丰满。
你的守则：
1. 逻辑重于一切：必须严格基于用户提供的【故事内核】、【世界观】和【角色小传】进行细化，绝对不允许背离设定。
2. 风格匹配：保持与参考内容的语境一致。
3. 严格遵循输出数量要求：用户要求 ${chapterCount} 章，就必须生成 ${chapterCount} 章。
4. 仅输出纯 JSON 数据，禁止任何废话。`;

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
          temperature: 0.7, // Slightly higher temp for creative splitting
          maxOutputTokens: 8192,
          responseMimeType: "application/json"
        }
      }));
      text = response.text || "[]";
    } else {
      const configWithHighTokens = { ...modelConfig, maxTokens: Math.max(modelConfig.maxTokens || 4096, 8192) };
      const result = await callOpenAICompatible(
        configWithHighTokens,
        [{ role: 'user', content: finalPrompt }],
        systemInstruction
      );
      text = result;
    }

    // Clean up potential markdown code blocks
    let jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();

    // Attempt to extract JSON array
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }

    try {
      return JSON.parse(jsonStr) as ChapterBeat[];
    } catch (parseError) {
      console.warn("Initial JSON parse failed, attempting iterative recovery for truncated JSON...");

      // Iterative Recovery Logic:
      // Repeatedly try to cut off the last '}' and append ']' until valid JSON is formed.
      // This effectively discards incomplete nested structures or incomplete last items.
      let currentStr = jsonStr;
      let attempts = 0;
      const MAX_ATTEMPTS = 50; // Prevent infinite loops for very large or malformed strings

      while (currentStr.lastIndexOf('}') !== -1 && attempts < MAX_ATTEMPTS) {
        attempts++;
        const lastBraceIdx = currentStr.lastIndexOf('}');

        // Keep everything up to this last brace
        currentStr = currentStr.substring(0, lastBraceIdx + 1);
        const attemptStr = currentStr + ']';

        try {
          const recoveredData = JSON.parse(attemptStr) as ChapterBeat[];
          console.log(`JSON recovery successful after ${attempts} attempts. Items recovered:`, recoveredData.length);
          return recoveredData;
        } catch (e) {
          // If this attempt failed, strip the last brace we just tried and continue searching backwards
          currentStr = currentStr.substring(0, currentStr.length - 1);
        }
      }

      console.error("JSON Parse Error. Raw Text:", text);
      throw new Error(`AI 返回格式错误，无法解析细纲数据。`);
    }
  } catch (error) {
    console.error("JSON Parse Error or AI Error", error);
    throw new Error("生成细纲失败或格式解析错误。");
  }
};

export const generateCharactersFromIdea = async (
  modelConfig: ModelConfig,
  context: {
    spark: string;
    core?: string;
    synopsis?: string;
    worldview?: string;
    requirements?: {
      protagonist: number;
      antagonist: number;
      supporting: number;
    };
  },
  customTemplate?: string
): Promise<Omit<CharacterProfile, 'id'>[]> => {
  let promptContent = '';

  const { requirements } = context;
  const countReq = requirements
    ? `请严格生成以下数量的角色：主角 ${requirements.protagonist} 人，反派 ${requirements.antagonist} 人，重要配角 ${requirements.supporting} 人。`
    : "请基于以上故事设定，设计 3-5 个核心角色（包括主角和关键配角/反派）。";

  if (customTemplate) {
    promptContent = customTemplate
      .replace(/{{spark}}/g, context.spark)
      .replace(/{{core}}/g, context.core || '')
      .replace(/{{synopsis}}/g, context.synopsis || '')
      .replace(/{{worldview}}/g, context.worldview || '')
      .replace(/{{input}}/g, context.synopsis || context.spark);
  } else {
    promptContent = `
      【灵感/脑洞】：${context.spark}
      ${context.core ? `【故事内核】：${context.core}` : ''}
      ${context.synopsis ? `【故事概要】：${context.synopsis}` : ''}
      ${context.worldview ? `【世界观设定】：${context.worldview}` : ''}

            ${countReq}
            
            要求：
            1. 角色性格要鲜明，有独特的辨识度。
            2. 角色背景要与世界观深度结合。
            3. 角色之间要有充满张力的关系。
            4. 请精简输出，【背景故事】和【性格描述】请严格控制在 100 字以内，避免过长导致内容截断。
          `;
  }

  const finalPrompt = `
          ${promptContent}
          
          IMPORTANT:
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
          ]
        `;

  const systemInstruction = "你是一个擅长创造鲜活角色的人物设计师。请设计有血有肉、动机合理的角色。仅返回纯 JSON 数据。";

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
          temperature: 0.8,
          maxOutputTokens: 8192,
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

    // Clean up potential markdown code blocks and whitespace
    let jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();

    // Ensure start from the first bracket
    const startIdx = jsonStr.indexOf('[');
    if (startIdx !== -1) {
      jsonStr = jsonStr.substring(startIdx);
    }

    try {
      return JSON.parse(jsonStr) as Omit<CharacterProfile, 'id'>[];
    } catch (parseError) {
      console.warn("Initial JSON parse failed, attempting recovery for truncated JSON...");

      // Recovery Logic: Try to find the last closing brace '}' and close the array
      const lastBraceIdx = jsonStr.lastIndexOf('}');
      if (lastBraceIdx !== -1) {
        // Take everything up to the last object end, and assume it's an array that needs closing
        const recoveredStr = jsonStr.substring(0, lastBraceIdx + 1) + ']';
        try {
          const recoveredData = JSON.parse(recoveredStr) as Omit<CharacterProfile, 'id'>[];
          console.log("JSON recovery successful. Items recovered:", recoveredData.length);
          return recoveredData;
        } catch (recoveryError) {
          console.error("JSON recovery failed.");
        }
      }

      console.error("JSON Parse Error. Raw Text:", text);
      throw new Error(`AI 返回格式错误，无法解析角色数据。原始响应片段: ${text.slice(0, 100)}...`);
    }
  } catch (error) {
    console.error("Generate Characters Error:", error);
    throw new Error(`生成角色失败: ${(error as Error).message}`);
  }
};

export const generateCompleteOutline = async (
  modelConfig: ModelConfig,
  data: {
    spark: string;
    core?: string;
    synopsis?: string;
    storyline?: string;
    worldview?: string;
    characters?: CharacterProfile[];
  },
  customTemplate?: string
): Promise<string> => {
  // 1. Optimize Character Data (Token Reduction Strategy)
  const optimizedCharacters = data.characters?.map(c =>
    `- ${c.name} (${c.role}): ${c.description} [性格核心: ${c.personality?.slice(0, 50) || '未设定'}]`
  ).join('\n') || "暂无具体角色设定";

  // 2. Construct the Context
  let finalPrompt = '';

  const contextBlock = `
          【核心灵感】：${data.spark}
          ${data.core ? `【故事内核】：${data.core}` : ''}
          ${data.synopsis ? `【故事概要】：${data.synopsis}` : ''}
          
          【世界观规则】：
          ${data.worldview ? data.worldview.slice(0, 1000) + (data.worldview.length > 1000 ? '...(略)' : '') : '暂无详细设定'}
          
          【核心角色阵容】：
          ${optimizedCharacters}
          
          ${data.storyline ? `【参考故事线】：\n${data.storyline}` : ''}
            `.trim();

  if (customTemplate) {
    finalPrompt = customTemplate
      .replace(/{{context}}/g, contextBlock)
      .replace(/{{spark}}/g, data.spark)
      .replace(/{{storyline}}/g, data.storyline || '')
      .replace(/{{worldview}}/g, data.worldview || '')
      .replace(/{{characters}}/g, optimizedCharacters);
  } else {
    finalPrompt = `
                ${contextBlock}
          
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
                
                请以 Markdown 格式输出。
              `;
  }

  const systemInstruction = "你是一个擅长结构布局的小说主编。请根据现有素材，编织出主线清晰、支线丰富、逻辑严密的大纲。";

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
          maxOutputTokens: 8192,
        }
      }));
      return response.text || "未能生成大纲。";
    } else {
      // Ensure sufficient tokens for full outline
      const configWithHighTokens = { ...modelConfig, maxTokens: Math.max(modelConfig.maxTokens || 4096, 8192) };
      return await callOpenAICompatible(
        configWithHighTokens,
        [{ role: 'user', content: finalPrompt }],
        systemInstruction
      );
    }
  } catch (error) {
    console.error("Generate Outline Error:", error);
    throw new Error(`生成大纲失败: ${(error as Error).message}`);
  }
};

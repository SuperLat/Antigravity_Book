
import React, { useState, useEffect, useRef } from 'react';
import { IdeaProject, ChapterBeat, AppSettings, PromptTemplate } from '../types';
import { Lightbulb, Globe, List, FileText, Plus, ArrowRight, Wand2, Loader2, BookPlus, Trash2, ChevronDown, Cpu } from 'lucide-react';
import { generateWorldviewFromIdea, generateOutlineFromWorldview, generateChapterBeatsFromOutline } from '../services/geminiService';

interface IdeaLabProps {
  ideas: IdeaProject[];
  settings: AppSettings;
  prompts: PromptTemplate[];
  onCreateIdea: () => void;
  onUpdateIdea: (id: string, updates: Partial<IdeaProject>) => void;
  onDeleteIdea: (id: string) => void;
  onConvertToBook: (idea: IdeaProject) => void;
}

const RECOMMENDED_MODELS = [

];

export const IdeaLab: React.FC<IdeaLabProps> = ({
  ideas,
  settings,
  prompts,
  onCreateIdea,
  onUpdateIdea,
  onDeleteIdea,
  onConvertToBook
}) => {
  const [activeIdeaId, setActiveIdeaId] = useState<string | null>(ideas[0]?.id || null);
  const [activeStage, setActiveStage] = useState<'spark' | 'world' | 'plot'>('spark');
  const [isGenerating, setIsGenerating] = useState(false);

  // Track previous length to detect creation/deletion
  const prevIdeasLength = useRef(ideas.length);

  // State to track selected AI models for each stage
  const [stageModels, setStageModels] = useState<{
    spark: string;
    world: string;
    plot: string;
    beats: string;
  }>(() => {
    const defaultModel = settings.models?.find(m => m.id === settings.defaultModelId) || settings.models?.[0];
    const defaultModelName = defaultModel?.modelName || 'gemini-2.5-flash';
    return {
      spark: defaultModelName,
      world: defaultModelName,
      plot: defaultModelName,
      beats: defaultModelName
    };
  });

  // Init models with default if not set
  useEffect(() => {
    if (!stageModels.spark) {
      const defaultModel = settings.models?.find(m => m.id === settings.defaultModelId) || settings.models?.[0];
      const defaultModelName = defaultModel?.modelName || 'gemini-2.5-flash';
      setStageModels({
        spark: defaultModelName,
        world: defaultModelName,
        plot: defaultModelName,
        beats: defaultModelName
      });
    }
  }, []);

  useEffect(() => {
    // 1. Detection: New idea created
    if (ideas.length > prevIdeasLength.current) {
      setActiveIdeaId(ideas[0].id);
      setActiveStage('spark');
    }
    // 2. Detection: Idea deleted
    else if (ideas.length < prevIdeasLength.current) {
      if (activeIdeaId && !ideas.find(i => i.id === activeIdeaId)) {
        setActiveIdeaId(ideas[0]?.id || null);
      }
    }
    // 3. Fallback: If no selection but ideas exist (initial load)
    else if (!activeIdeaId && ideas.length > 0) {
      setActiveIdeaId(ideas[0].id);
    }

    prevIdeasLength.current = ideas.length;
  }, [ideas, activeIdeaId]);

  // Selected Prompts State
  const [sparkPromptId, setSparkPromptId] = useState<string>('default');
  const [worldPromptId, setWorldPromptId] = useState<string>('default'); // Actually used for Outline generation
  const [outlinePromptId, setOutlinePromptId] = useState<string>('default'); // Used for re-generating Outline
  const [beatsPromptId, setBeatsPromptId] = useState<string>('default');

  // Initialize default prompts
  const hasInitializedPrompts = useRef(false);
  useEffect(() => {
    if (hasInitializedPrompts.current) return;
    if (prompts.length === 0) return;

    const initDefaultPrompt = (category: string, setter: (id: string) => void) => {
      const defaultPrompt = prompts.find(p => p.category === category && p.isDefault);
      if (defaultPrompt) {
        setter(defaultPrompt.id);
      }
    };

    initDefaultPrompt('brainstorm', setSparkPromptId);
    initDefaultPrompt('outline', setWorldPromptId);
    initDefaultPrompt('outline', setOutlinePromptId);
    initDefaultPrompt('beats', setBeatsPromptId);

    hasInitializedPrompts.current = true;
  }, [prompts]);

  const activeIdea = ideas.find(i => i.id === activeIdeaId);

  // Filter prompts by category
  const brainstormPrompts = prompts.filter(p => p.category === 'brainstorm');
  const worldPrompts = prompts.filter(p => p.category === 'world');
  const outlinePrompts = prompts.filter(p => p.category === 'outline');
  const beatsPrompts = prompts.filter(p => p.category === 'beats');

  const handleGenerateWorld = async () => {
    if (!activeIdea || isGenerating) return;
    setIsGenerating(true);
    try {
      const customTemplate = sparkPromptId !== 'default' ? prompts.find(p => p.id === sparkPromptId)?.template : undefined;
      // Use Stage Specific Model
      const defaultModel = settings.models?.find(m => m.id === settings.defaultModelId) || settings.models?.[0];
      if (!defaultModel) throw new Error('没有配置模型');
      const tempConfig = { ...defaultModel, modelName: stageModels.spark };

      const result = await generateWorldviewFromIdea(tempConfig, activeIdea.spark, customTemplate);
      onUpdateIdea(activeIdea.id, { worldview: result });
      setActiveStage('world');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateOutline = async () => {
    if (!activeIdea || isGenerating) return;
    setIsGenerating(true);
    try {
      const customTemplate = worldPromptId !== 'default' ? prompts.find(p => p.id === worldPromptId)?.template : undefined;
      // Use Stage Specific Model (World Stage -> generates Outline)
      const defaultModel = settings.models?.find(m => m.id === settings.defaultModelId) || settings.models?.[0];
      if (!defaultModel) throw new Error('没有配置模型');
      const tempConfig = { ...defaultModel, modelName: stageModels.world };

      const result = await generateOutlineFromWorldview(tempConfig, activeIdea.worldview, activeIdea.spark, customTemplate);
      onUpdateIdea(activeIdea.id, { outline: result });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateBeats = async () => {
    if (!activeIdea || isGenerating) return;
    setIsGenerating(true);
    try {
      const customTemplate = beatsPromptId !== 'default' ? prompts.find(p => p.id === beatsPromptId)?.template : undefined;
      // Use Stage Specific Model (Beats generation is usually inside Plot stage UI, but is a distinct step)
      const defaultModel = settings.models?.find(m => m.id === settings.defaultModelId) || settings.models?.[0];
      if (!defaultModel) throw new Error('没有配置模型');
      const tempConfig = { ...defaultModel, modelName: stageModels.beats };

      const result = await generateChapterBeatsFromOutline(tempConfig, activeIdea.outline, customTemplate);
      onUpdateIdea(activeIdea.id, { chapterBeats: result });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper for Model Selector UI
  const ModelSelector = ({ stage }: { stage: 'spark' | 'world' | 'plot' | 'beats' }) => (
    <div className="relative group">
      <Cpu className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      <input
        list="idealab-models"
        value={stageModels[stage]}
        onChange={(e) => setStageModels(prev => ({ ...prev, [stage]: e.target.value }))}
        className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded py-2 pl-8 pr-2 w-32 focus:outline-none focus:border-indigo-500 hover:border-gray-600 transition-colors truncate"
        placeholder="Model..."
        title={`当前阶段使用的模型: ${stageModels[stage]}`}
      />
    </div>
  );

  return (
    <div className="flex-1 flex bg-gray-950 h-full overflow-hidden">
      <datalist id="idealab-models">
        {RECOMMENDED_MODELS.map(m => <option key={m} value={m} />)}
      </datalist>

      {/* Sidebar List - Always Visible */}
      <div className="w-64 border-r border-gray-800 bg-gray-900/50 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <h2 className="font-bold text-gray-200 flex items-center">
            <Lightbulb className="w-5 h-5 mr-2 text-yellow-500" />
            灵感实验室
          </h2>
          <button onClick={onCreateIdea} className="p-1 hover:bg-gray-700 rounded text-indigo-400" title="新建灵感">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {ideas.map(idea => (
            <div
              key={idea.id}
              className={`group flex items-stretch w-full rounded transition-colors border mb-1 overflow-hidden ${activeIdeaId === idea.id
                ? 'bg-gray-800 text-white border-l-yellow-500 border-l-2 border-t-transparent border-r-transparent border-b-transparent'
                : 'text-gray-400 border-transparent hover:bg-gray-800 hover:border-gray-700'
                }`}
            >
              <button
                onClick={() => setActiveIdeaId(idea.id)}
                className="flex-1 text-left px-3 py-3 min-w-0"
              >
                <div className="font-medium truncate">{idea.title || "新灵感项目"}</div>
                <div className="text-xs opacity-50 truncate mt-1">{idea.spark || "暂无描述..."}</div>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteIdea(idea.id);
                }}
                className={`px-2 flex items-center justify-center transition-all cursor-pointer ${activeIdeaId === idea.id
                  ? 'text-gray-400 hover:text-red-400 hover:bg-red-900/20'
                  : 'text-gray-500 hover:text-red-400 hover:bg-red-900/20 opacity-0 group-hover:opacity-100'
                  }`}
                title="删除项目"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {ideas.length === 0 && (
            <div className="text-center py-8 text-gray-600 text-xs">
              暂无灵感，点击右上角 + 新建
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace */}
      {activeIdea ? (
        <div className="flex-1 flex flex-col h-full bg-gray-950">
          {/* Header */}
          <div className="h-16 border-b border-gray-800 flex items-center justify-between px-8 bg-gray-900/30">
            <input
              value={activeIdea.title}
              onChange={(e) => onUpdateIdea(activeIdea.id, { title: e.target.value })}
              className="bg-transparent text-xl font-bold text-white focus:outline-none placeholder-gray-600 w-1/2"
              placeholder="未命名灵感"
            />
            <button
              onClick={() => onConvertToBook(activeIdea)}
              className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md text-sm font-medium transition-colors shadow-lg shadow-green-500/20"
            >
              <BookPlus className="w-4 h-4 mr-2" />
              转为作品
            </button>
          </div>

          {/* Stages Navigation */}
          <div className="flex border-b border-gray-800 px-8">
            <button
              onClick={() => setActiveStage('spark')}
              className={`py-4 mr-8 text-sm font-medium flex items-center border-b-2 transition-colors ${activeStage === 'spark' ? 'border-yellow-500 text-yellow-500' : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
            >
              <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center mr-2 text-xs">1</div>
              灵感碎片 (Spark)
            </button>
            <button
              onClick={() => setActiveStage('world')}
              className={`py-4 mr-8 text-sm font-medium flex items-center border-b-2 transition-colors ${activeStage === 'world' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
            >
              <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center mr-2 text-xs">2</div>
              世界构建 (World)
            </button>
            <button
              onClick={() => setActiveStage('plot')}
              className={`py-4 mr-8 text-sm font-medium flex items-center border-b-2 transition-colors ${activeStage === 'plot' ? 'border-purple-500 text-purple-500' : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
            >
              <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center mr-2 text-xs">3</div>
              剧情大纲 (Plot)
            </button>
          </div>

          {/* Stage Content */}
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-8">

              {/* STAGE 1: SPARK */}
              {activeStage === 'spark' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="bg-yellow-900/10 border border-yellow-500/30 p-6 rounded-lg">
                    <h3 className="text-lg font-bold text-yellow-400 mb-2 flex items-center">
                      <Lightbulb className="w-5 h-5 mr-2" /> 核心梗 / 脑洞
                    </h3>
                    <p className="text-sm text-gray-400 mb-4">
                      在这里写下你的核心创意。例如：“赛博朋克背景下的修仙故事，核心是义体飞升”或者“一个只能在梦中杀人的刺客”。
                    </p>
                    <textarea
                      value={activeIdea.spark}
                      onChange={(e) => onUpdateIdea(activeIdea.id, { spark: e.target.value })}
                      className="w-full h-40 bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-200 focus:ring-2 focus:ring-yellow-500 outline-none resize-none"
                      placeholder="输入你的灵感..."
                    />
                  </div>
                  <div className="flex justify-end items-center gap-4">
                    {/* Prompt Selector */}
                    <div className="relative">
                      <select
                        value={sparkPromptId}
                        onChange={(e) => setSparkPromptId(e.target.value)}
                        className="appearance-none bg-gray-800 border border-gray-700 text-gray-300 py-2 pl-3 pr-8 rounded text-sm focus:outline-none focus:border-blue-500 hover:border-gray-600"
                      >
                        <option value="default">使用默认逻辑</option>
                        {brainstormPrompts.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    <ModelSelector stage="spark" />

                    <button
                      onClick={handleGenerateWorld}
                      disabled={!activeIdea.spark || isGenerating}
                      className="flex items-center px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                      生成世界观
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </button>
                  </div>
                </div>
              )}

              {/* STAGE 2: WORLD */}
              {activeStage === 'world' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-bold text-blue-400 flex items-center">
                      <Globe className="w-5 h-5 mr-2" /> 世界观设定
                    </h3>
                    <div className="flex items-center gap-2">
                      {/* Re-generate World using Spark Prompt logic */}
                      <select
                        value={sparkPromptId}
                        onChange={(e) => setSparkPromptId(e.target.value)}
                        className="appearance-none bg-gray-800 border border-gray-700 text-gray-400 py-1 pl-2 pr-6 rounded text-xs focus:outline-none focus:border-blue-500"
                      >
                        <option value="default">默认重成逻辑</option>
                        {brainstormPrompts.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleGenerateWorld}
                        disabled={isGenerating}
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center"
                      >
                        <Wand2 className="w-3 h-3 mr-1" /> 重新生成
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={activeIdea.worldview}
                    onChange={(e) => onUpdateIdea(activeIdea.id, { worldview: e.target.value })}
                    className="w-full h-[500px] bg-gray-900 border border-gray-700 rounded-lg p-6 text-gray-300 leading-relaxed focus:ring-2 focus:ring-blue-500 outline-none resize-none font-serif"
                    placeholder="点击“生成世界观”让AI为你构建，或者手动输入..."
                  />
                  <div className="flex justify-end items-center gap-4">
                    {/* Prompt Selector for Outline Generation */}
                    <div className="relative">
                      <select
                        value={outlinePromptId}
                        onChange={(e) => setOutlinePromptId(e.target.value)}
                        className="appearance-none bg-gray-800 border border-gray-700 text-gray-300 py-2 pl-3 pr-8 rounded text-sm focus:outline-none focus:border-purple-500 hover:border-gray-600"
                      >
                        <option value="default">使用默认大纲逻辑</option>
                        {outlinePrompts.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    <ModelSelector stage="world" />

                    <button
                      onClick={handleGenerateOutline}
                      disabled={!activeIdea.worldview || isGenerating}
                      className="flex items-center px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                      生成大纲
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </button>
                  </div>
                </div>
              )}

              {/* STAGE 3: PLOT */}
              {activeStage === 'plot' && (
                <div className="space-y-8 animate-fadeIn">
                  {/* Macro Outline */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-purple-400 flex items-center">
                        <List className="w-5 h-5 mr-2" /> 宏观大纲 (三幕式)
                      </h3>
                      <div className="flex items-center gap-2">
                        <select
                          value={outlinePromptId}
                          onChange={(e) => setOutlinePromptId(e.target.value)}
                          className="appearance-none bg-gray-800 border border-gray-700 text-gray-400 py-1 pl-2 pr-6 rounded text-xs focus:outline-none focus:border-purple-500"
                        >
                          <option value="default">默认重成逻辑</option>
                          {outlinePrompts.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={handleGenerateOutline}
                          disabled={isGenerating}
                          className="text-xs text-purple-400 hover:text-purple-300 flex items-center"
                        >
                          <Wand2 className="w-3 h-3 mr-1" /> 重新生成
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={activeIdea.outline}
                      onChange={(e) => onUpdateIdea(activeIdea.id, { outline: e.target.value })}
                      className="w-full h-64 bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-300 leading-relaxed focus:ring-2 focus:ring-purple-500 outline-none resize-none font-serif"
                      placeholder="大纲生成区..."
                    />
                  </div>

                  {/* Chapter Beats */}
                  <div>
                    <div className="flex justify-between items-center mb-4 border-t border-gray-800 pt-8">
                      <h3 className="text-lg font-bold text-green-400 flex items-center">
                        <FileText className="w-5 h-5 mr-2" /> 章节细纲 (第一卷)
                      </h3>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <select
                            value={beatsPromptId}
                            onChange={(e) => setBeatsPromptId(e.target.value)}
                            className="appearance-none bg-gray-800 border border-gray-700 text-gray-300 py-1.5 pl-3 pr-8 rounded text-xs focus:outline-none focus:border-green-500"
                          >
                            <option value="default">默认拆分逻辑</option>
                            {beatsPrompts.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          <ChevronDown className="w-3 h-3 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        <ModelSelector stage="beats" />

                        <button
                          onClick={handleGenerateBeats}
                          disabled={!activeIdea.outline || isGenerating}
                          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-green-400 rounded text-xs flex items-center border border-gray-700"
                        >
                          {isGenerating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Wand2 className="w-3 h-3 mr-1" />}
                          拆分章节
                        </button>
                      </div>
                    </div>

                    {(!activeIdea.chapterBeats || activeIdea.chapterBeats.length === 0) ? (
                      <div className="text-center py-12 border-2 border-dashed border-gray-800 rounded-lg text-gray-600">
                        生成大纲后，点击上方按钮拆分章节细纲
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {activeIdea.chapterBeats.map((beat, idx) => (
                          <div key={idx} className="bg-gray-900 border border-gray-700 rounded-lg p-4 hover:border-green-500/50 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-bold text-white">{beat.chapterTitle}</h4>
                              <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400">Chapter {idx + 1}</span>
                            </div>
                            <p className="text-sm text-gray-400 mb-3">{beat.summary}</p>
                            <div className="flex gap-2 text-xs">
                              <div className="bg-red-900/30 text-red-300 px-2 py-1 rounded border border-red-500/20">
                                冲突: {beat.conflict}
                              </div>
                              {beat.keyCharacters.map(char => (
                                <div key={char} className="bg-blue-900/30 text-blue-300 px-2 py-1 rounded border border-blue-500/20">
                                  {char}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 h-full bg-gray-950">
          <div className="bg-gray-900/50 p-12 rounded-xl border border-gray-800 flex flex-col items-center">
            <Lightbulb className="w-16 h-16 mb-6 opacity-20" />
            <p className="mb-6 text-lg font-medium">
              {ideas.length === 0 ? '灵感实验室空空如也' : '请选择一个灵感项目'}
            </p>
            <button
              onClick={onCreateIdea}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center transition-colors shadow-lg shadow-indigo-500/20"
            >
              <Plus className="w-5 h-5 mr-2" />
              {ideas.length === 0 ? '开启第一个脑洞' : '新建灵感'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

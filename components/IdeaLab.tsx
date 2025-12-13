
import React, { useState, useEffect, useRef } from 'react';
import { IdeaProject, ChapterBeat, AppSettings, PromptTemplate, BeatsSplit, Book, Chapter } from '../types';
import { Lightbulb, Globe, List, FileText, Plus, ArrowRight, Wand2, Loader2, BookPlus, Trash2, ChevronDown, ChevronRight, ChevronUp, Cpu, History, Clock, Link as LinkIcon, Check, Upload } from 'lucide-react';
import { generateWorldviewFromIdea, generateOutlineFromWorldview, generateChapterBeatsFromOutline, generateBeatsFromVolumeContent, generateVolumesFromOutline, generatePartsFromVolume, generateStorylineFromIdea, generateOutlineFromStoryline } from '../services/geminiService';

// ... (imports)

// ... (inside component)

const handleGenerateBeats = async () => {
  // ... (existing code)
};


interface IdeaLabProps {
  ideas: IdeaProject[];
  books?: Book[];
  settings: AppSettings;
  prompts: PromptTemplate[];
  onCreateIdea: () => void;
  onUpdateIdea: (id: string, updates: Partial<IdeaProject>) => void;
  onDeleteIdea: (id: string) => void;
  onConvertToBook: (idea: IdeaProject) => void;
  onSelectBook?: (id: string) => void;
  onPushChapters?: (bookId: string, chapters: Chapter[]) => void;
}

const RECOMMENDED_MODELS = [

];

export const IdeaLab: React.FC<IdeaLabProps> = ({
  ideas,
  books = [],
  settings,
  prompts,
  onCreateIdea,
  onUpdateIdea,
  onDeleteIdea,
  onConvertToBook,
  onSelectBook,
  onPushChapters
}) => {
  const [activeIdeaId, setActiveIdeaId] = useState<string | null>(ideas[0]?.id || null);
  const [activeStage, setActiveStage] = useState<'spark' | 'plot' | 'volume' | 'beats'>('spark');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);

  // Track previous length to detect creation/deletion
  const prevIdeasLength = useRef(ideas.length);

  // State to track selected AI models for each stage
  const [stageModels, setStageModels] = useState<{
    spark: string;
    story: string; // For Storyline -> Outline
    plot: string;
    volume: string;
    beats: string;
  }>(() => {
    const defaultModel = settings.models?.find(m => m.id === settings.defaultModelId) || settings.models?.[0];
    const defaultModelName = defaultModel?.modelName || 'gemini-2.5-flash';
    return {
      spark: defaultModelName,
      story: defaultModelName,
      plot: defaultModelName,
      volume: defaultModelName,
      beats: defaultModelName
    };
  });

  const [volumeContent, setVolumeContent] = useState('');
  const [splitChapterCount, setSplitChapterCount] = useState(3);
  const [showSplitHistory, setShowSplitHistory] = useState(false);
  const [currentSplit, setCurrentSplit] = useState<BeatsSplit | null>(null);

  // Linked Book Context State
  const [useLinkedBookContext, setUseLinkedBookContext] = useState(false);
  const [linkedRefChapterIds, setLinkedRefChapterIds] = useState<string[]>([]);
  const [isMultiSelectOpen, setIsMultiSelectOpen] = useState(false);

  // Expanded states for history items
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<string[]>([]);

  const toggleHistoryExpand = (id: string) => {
    setExpandedHistoryIds(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

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
  const [storyPromptId, setStoryPromptId] = useState<string>('default'); // Storyline -> Outline
  const [worldPromptId, setWorldPromptId] = useState<string>('default'); // Actually used for Outline generation
  const [outlinePromptId, setOutlinePromptId] = useState<string>('default'); // Used for re-generating Outline
  const [volumePromptId, setVolumePromptId] = useState<string>('default');
  const [beatsPromptId, setBeatsPromptId] = useState<string>('default');

  const [activeVolumeId, setActiveVolumeId] = useState<string | null>(null);

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
    initDefaultPrompt('outline', setStoryPromptId); // Use outline prompts for Story->Outline
    initDefaultPrompt('outline', setWorldPromptId);
    initDefaultPrompt('outline', setOutlinePromptId);
    initDefaultPrompt('outline', setVolumePromptId); // Use outline prompts for volume for now, or add new category
    initDefaultPrompt('beats', setBeatsPromptId);

    hasInitializedPrompts.current = true;
  }, [prompts]);

  const activeIdea = ideas.find(i => i.id === activeIdeaId);

  const [activePartId, setActivePartId] = useState<string | null>(null);

  // Filter prompts by category
  const brainstormPrompts = prompts.filter(p => p.category === 'brainstorm');
  const worldPrompts = prompts.filter(p => p.category === 'world');
  const outlinePrompts = prompts.filter(p => p.category === 'outline');
  const beatsPrompts = prompts.filter(p => p.category === 'beats');

  const handleGenerateStoryline = async () => {
    if (!activeIdea || isGenerating) return;
    setIsGenerating(true);
    try {
      const customTemplate = sparkPromptId !== 'default' ? prompts.find(p => p.id === sparkPromptId)?.template : undefined;
      const defaultModel = settings.models?.find(m => m.id === settings.defaultModelId) || settings.models?.[0];
      if (!defaultModel) throw new Error('没有配置模型');
      const tempConfig = { ...defaultModel, modelName: stageModels.spark };

      const result = await generateStorylineFromIdea(tempConfig, activeIdea.spark, customTemplate);
      onUpdateIdea(activeIdea.id, { storyline: result });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStorylineToOutline = async () => {
    if (!activeIdea || isGenerating || !activeIdea.storyline) return;
    setIsGenerating(true);
    try {
      const customTemplate = storyPromptId !== 'default' ? prompts.find(p => p.id === storyPromptId)?.template : undefined;
      const defaultModel = settings.models?.find(m => m.id === settings.defaultModelId) || settings.models?.[0];
      if (!defaultModel) throw new Error('没有配置模型');
      const tempConfig = { ...defaultModel, modelName: stageModels.story };

      const result = await generateOutlineFromStoryline(tempConfig, activeIdea.storyline, customTemplate);
      onUpdateIdea(activeIdea.id, { outline: result });
      setActiveStage('plot');
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
      const tempConfig = { ...defaultModel, modelName: stageModels.plot };

      const result = await generateOutlineFromWorldview(tempConfig, activeIdea.worldview, activeIdea.spark, customTemplate);
      onUpdateIdea(activeIdea.id, { outline: result });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateVolumes = async () => {
    if (!activeIdea || isGenerating) return;
    setIsGenerating(true);
    try {
      const customTemplate = volumePromptId !== 'default' ? prompts.find(p => p.id === volumePromptId)?.template : undefined;
      const defaultModel = settings.models?.find(m => m.id === settings.defaultModelId) || settings.models?.[0];
      if (!defaultModel) throw new Error('没有配置模型');
      const tempConfig = { ...defaultModel, modelName: stageModels.volume };

      const volumesData = await generateVolumesFromOutline(tempConfig, activeIdea.outline, customTemplate);

      const newVolumes = volumesData.map((v, idx) => ({
        id: Date.now().toString() + idx,
        title: v.title,
        summary: v.summary,
        order: idx + 1
      }));

      onUpdateIdea(activeIdea.id, { volumes: newVolumes });
      if (newVolumes.length > 0) {
        setActiveVolumeId(newVolumes[0].id);
      }
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateParts = async () => {
    if (!activeIdea || !activeVolumeId || isGenerating) return;
    const activeVol = activeIdea.volumes?.find(v => v.id === activeVolumeId);
    if (!activeVol) return;

    setIsGenerating(true);
    try {
      const customTemplate = volumePromptId !== 'default' ? prompts.find(p => p.id === volumePromptId)?.template : undefined;
      const defaultModel = settings.models?.find(m => m.id === settings.defaultModelId) || settings.models?.[0];
      if (!defaultModel) throw new Error('没有配置模型');
      const tempConfig = { ...defaultModel, modelName: stageModels.volume };

      const partsData = await generatePartsFromVolume(tempConfig, activeVol.title, activeVol.summary, customTemplate);

      const newParts = partsData.map((p, idx) => ({
        id: Date.now().toString() + '_p' + idx,
        title: p.title,
        summary: p.summary,
        order: idx + 1
      }));

      const updatedVolumes = activeIdea.volumes!.map(v =>
        v.id === activeVolumeId ? { ...v, parts: newParts } : v
      );

      onUpdateIdea(activeIdea.id, { volumes: updatedVolumes });
      if (newParts.length > 0) {
        setActivePartId(newParts[0].id);
      }
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

  // New: Volume-based beats splitting


  const handleSplitVolume = async () => {
    if (!activeIdea || isGenerating || !volumeContent.trim()) return;
    setIsGenerating(true);
    try {
      const modelConfig = settings.models?.find(m => m.id === settings.defaultModelId) || settings.models?.[0];
      if (!modelConfig) throw new Error('没有配置模型');

      const customTemplate = beatsPromptId !== 'default' ? beatsPrompts.find(p => p.id === beatsPromptId)?.template : undefined;
      let startChapter = (activeIdea.lastSplitChapterNum || 0) + 1;
      let finalContent = volumeContent;

      // Handle Linked Book Context
      if (useLinkedBookContext && activeIdea.linkedBookId) {
        const linkedBook = books?.find(b => b.id === activeIdea.linkedBookId);
        if (linkedBook && linkedBook.chapters.length > 0) {
          if (linkedRefChapterIds.length > 0) {
            // Multi-select mode
            const selectedChapters = linkedBook.chapters.filter(c => linkedRefChapterIds.includes(c.id));
            // Sort by order in book
            const sortedSelected = selectedChapters.sort((a, b) => {
              return linkedBook.chapters.indexOf(a) - linkedBook.chapters.indexOf(b);
            });

            const refContent = sortedSelected.map(c =>
              `【章节：${c.title}】\n${c.summary || c.content.slice(0, 500)}...`
            ).join('\n\n');

            finalContent = `【前情提要 (基于已选关联章节)】\n${refContent}\n\n【接下来的剧情大纲】\n${volumeContent}`;
          } else {
            // Fallback to last chapter
            const targetChapter = linkedBook.chapters[linkedBook.chapters.length - 1];
            if (targetChapter) {
              finalContent = `【前情提要 (基于已有关联章节: ${targetChapter.title})】\n${targetChapter.summary || targetChapter.content.slice(0, 800)}...\n\n【接下来的剧情大纲】\n${volumeContent}`;
            }
          }
        }
      }

      const beats = await generateBeatsFromVolumeContent(
        { ...modelConfig, modelName: stageModels.beats },
        finalContent,
        splitChapterCount,
        startChapter,
        customTemplate
      );

      const newSplit: BeatsSplit = {
        id: Date.now().toString(),
        volumeContent,
        chapterCount: splitChapterCount,
        startChapter,
        beats,
        createdAt: Date.now()
      };

      const updatedHistory = [...(activeIdea.beatsSplitHistory || []), newSplit];
      const lastChapterNum = startChapter + beats.length - 1;

      // Update idea with new split history and cumulative beats
      onUpdateIdea(activeIdea.id, {
        beatsSplitHistory: updatedHistory,
        lastSplitChapterNum: lastChapterNum,
        chapterBeats: [...(activeIdea.chapterBeats || []), ...beats]
      });

      setCurrentSplit(newSplit);
      setVolumeContent(''); // Clear input
      setShowSplitHistory(false); // Show current result
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteSplit = (splitId: string) => {
    if (!activeIdea || !window.confirm('确定要删除这条拆分记录吗？')) return;

    const updatedHistory = activeIdea.beatsSplitHistory?.filter(s => s.id !== splitId) || [];

    // Recalculate lastSplitChapterNum based on remaining history
    // This is a simplification; ideally we might want to re-sort or handle gaps, 
    // but for now we just take the max end chapter of remaining splits or 0
    let maxChapter = 0;
    updatedHistory.forEach(split => {
      const end = split.startChapter + split.beats.length - 1;
      if (end > maxChapter) maxChapter = end;
    });

    onUpdateIdea(activeIdea.id, {
      beatsSplitHistory: updatedHistory,
      lastSplitChapterNum: maxChapter
      // Note: We are NOT removing the actual beats from chapterBeats array here 
      // because mapping them back is complex. We assume user manages chapterBeats separately or we treat history as a log.
      // If strict sync is needed, we'd need to filter chapterBeats too. 
      // For now, let's keep it simple as a history log management.
    });
  };

  // Helper for Model Selector UI
  const ModelSelector = ({ stage }: { stage: 'spark' | 'story' | 'plot' | 'volume' | 'beats' }) => (
    <div className="relative group">
      <Cpu className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      <select
        value={stageModels[stage]}
        onChange={(e) => setStageModels(prev => ({ ...prev, [stage]: e.target.value }))}
        className="appearance-none bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded py-2 pl-8 pr-8 w-40 focus:outline-none focus:border-indigo-500 hover:border-gray-600 transition-colors truncate cursor-pointer"
        title={`当前阶段使用的模型: ${stageModels[stage]}`}
      >
        {settings.models?.map(model => (
          <option key={model.id} value={model.modelName}>
            {model.name || model.modelName}
          </option>
        ))}
        {(!settings.models || settings.models.length === 0) && (
          <>
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="gpt-4o">GPT-4o</option>
          </>
        )}
      </select>
      <ChevronDown className="w-3 h-3 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
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
            <div className="flex items-center gap-2">
              {activeIdea.linkedBookId ? (
                <button
                  onClick={() => onSelectBook?.(activeIdea.linkedBookId!)}
                  className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  进入写作
                </button>
              ) : (
                <button
                  onClick={() => setShowLinkModal(true)}
                  className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md text-sm font-medium transition-colors shadow-lg shadow-green-500/20"
                >
                  <BookPlus className="w-4 h-4 mr-2" />
                  转为作品
                </button>
              )}
            </div>
          </div>

          {/* Stages Navigation */}
          <div className="flex border-b border-gray-800 px-8">
            <button
              onClick={() => setActiveStage('spark')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center ${activeStage === 'spark'
                ? 'border-yellow-500 text-yellow-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
            >
              <Lightbulb className="w-4 h-4 mr-2" />
              1. 灵感 (Spark)
            </button>
            <button
              onClick={() => setActiveStage('plot')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center ${activeStage === 'plot'
                ? 'border-yellow-500 text-yellow-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
            >
              <List className="w-4 h-4 mr-2" />
              2. 剧情大纲 (Plot)
            </button>
            <button
              onClick={() => setActiveStage('volume')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center ${activeStage === 'volume'
                ? 'border-yellow-500 text-yellow-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
            >
              <List className="w-4 h-4 mr-2" />
              3. 卷纲 (Volume)
            </button>
            <button
              onClick={() => setActiveStage('beats')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center ${activeStage === 'beats'
                ? 'border-yellow-500 text-yellow-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
            >
              <FileText className="w-4 h-4 mr-2" />
              4. 章节细纲 (Beats)
            </button>
          </div>

          {/* Stage Content */}
          <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-8">

              {/* STAGE 1: SPARK */}
              {activeStage === 'spark' && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Part 1: Brainstorm */}
                  <div className="bg-yellow-900/10 border border-yellow-500/30 p-6 rounded-lg">
                    <h3 className="text-lg font-bold text-yellow-400 mb-2 flex items-center">
                      <Lightbulb className="w-5 h-5 mr-2" /> 1. 核心梗 / 脑洞
                    </h3>
                    <p className="text-sm text-gray-400 mb-4">
                      在这里写下你的核心创意。例如：“赛博朋克背景下的修仙故事，核心是义体飞升”。
                    </p>
                    <textarea
                      value={activeIdea.spark}
                      onChange={(e) => onUpdateIdea(activeIdea.id, { spark: e.target.value })}
                      className="w-full h-32 bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-200 focus:ring-2 focus:ring-yellow-500 outline-none resize-none"
                      placeholder="输入你的灵感..."
                    />
                    <div className="flex justify-end items-center gap-4 mt-4">
                      {/* Prompt Selector 1 */}
                      <div className="relative">
                        <select
                          value={sparkPromptId}
                          onChange={(e) => setSparkPromptId(e.target.value)}
                          className="appearance-none bg-gray-800 border border-gray-700 text-gray-300 py-2 pl-3 pr-8 rounded text-sm focus:outline-none focus:border-yellow-500 hover:border-gray-600"
                        >
                          <option value="default">默认: 生成故事线</option>
                          {brainstormPrompts.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>

                      <ModelSelector stage="spark" />

                      <button
                        onClick={handleGenerateStoryline}
                        disabled={!activeIdea.spark || isGenerating}
                        className="flex items-center px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                        生成故事线
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </button>
                    </div>
                  </div>

                  {/* Part 2: Storyline (Visible if generated or manually added) */}
                  {(activeIdea.storyline || activeIdea.spark) && (
                    <div className="bg-blue-900/10 border border-blue-500/30 p-6 rounded-lg animate-fadeIn">
                      <h3 className="text-lg font-bold text-blue-400 mb-2 flex items-center">
                        <FileText className="w-5 h-5 mr-2" /> 2. 故事线 (Storyline)
                      </h3>
                      <p className="text-sm text-gray-400 mb-4">
                        AI 生成的故事脉络。你可以对其进行修改和润色，确认无误后生成完整大纲。
                      </p>
                      <textarea
                        value={activeIdea.storyline || ''}
                        onChange={(e) => onUpdateIdea(activeIdea.id, { storyline: e.target.value })}
                        className="w-full h-64 bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none font-serif leading-relaxed"
                        placeholder="等待生成故事线，或直接在此输入..."
                      />
                      <div className="flex justify-end items-center gap-4 mt-4">
                        {/* Prompt Selector 2 */}
                        <div className="relative">
                          <select
                            value={storyPromptId}
                            onChange={(e) => setStoryPromptId(e.target.value)}
                            className="appearance-none bg-gray-800 border border-gray-700 text-gray-300 py-2 pl-3 pr-8 rounded text-sm focus:outline-none focus:border-blue-500 hover:border-gray-600"
                          >
                            <option value="default">默认: 生成大纲</option>
                            {outlinePrompts.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        <ModelSelector stage="story" />

                        <button
                          onClick={handleStorylineToOutline}
                          disabled={!activeIdea.storyline || isGenerating}
                          className="flex items-center px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                          生成大纲
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}



              {/* STAGE 2: PLOT */}
              {activeStage === 'plot' && (
                <div className="flex flex-col h-full animate-fadeIn"> {/* 移除 space-y-8，并改为 flex-col h-full */}
                  {/* Macro Outline */}
                  <div className="flex-1 flex flex-col"> {/* 使其可以撑满 */}
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-purple-400 flex items-center">
                        <List className="w-5 h-5 mr-2" /> 宏观大纲
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
                      className="w-full flex-1 min-h-[800px] bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-300 leading-relaxed focus:ring-2 focus:ring-purple-500 outline-none resize-none font-serif"
                      placeholder="大纲生成区..."
                    />
                  </div>
                </div>
              )}


              {/* STAGE 4: VOLUME */}
              {activeStage === 'volume' && (
                <div className="max-w-4xl mx-auto space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white flex items-center">
                      <List className="w-5 h-5 mr-2 text-yellow-500" />
                      分卷大纲 (Volume Outline)
                    </h3>
                    <div className="flex items-center gap-4">
                      <ModelSelector stage="volume" />
                      <button
                        onClick={handleGenerateVolumes}
                        disabled={isGenerating || !activeIdea.outline}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-medium transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                        生成分卷
                      </button>
                      <button
                        onClick={() => {
                          const newVol = { id: Date.now().toString(), title: '新分卷', summary: '', order: (activeIdea.volumes?.length || 0) + 1 };
                          const newVolumes = [...(activeIdea.volumes || []), newVol];
                          onUpdateIdea(activeIdea.id, { volumes: newVolumes });
                          setActiveVolumeId(newVol.id);
                        }}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors flex items-center"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        添加分卷
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6 h-[600px]">
                    {/* Left: Volume List */}
                    <div className="col-span-1 bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden flex flex-col">
                      <div className="p-3 border-b border-gray-800 font-medium text-gray-400 text-sm">
                        卷列表
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {activeIdea.volumes && activeIdea.volumes.length > 0 ? (
                          activeIdea.volumes.map((vol, idx) => (
                            <div
                              key={vol.id}
                              onClick={() => setActiveVolumeId(vol.id)}
                              className={`p-3 rounded cursor-pointer transition-colors border ${activeVolumeId === vol.id
                                ? 'bg-indigo-900/30 border-indigo-500/50 text-white'
                                : 'bg-gray-800/30 border-transparent text-gray-400 hover:bg-gray-800'
                                }`}
                            >
                              <div className="font-medium text-sm truncate">{vol.title}</div>
                              <div className="text-xs text-gray-500 mt-1 truncate">{vol.summary}</div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 text-gray-600 text-sm">
                            暂无分卷，请点击生成或添加
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Volume Detail */}
                    <div className="col-span-2 bg-gray-900/50 border border-gray-800 rounded-lg flex flex-col overflow-hidden">
                      {activeVolumeId ? (
                        (() => {
                          const activeVol = activeIdea.volumes?.find(v => v.id === activeVolumeId);
                          if (!activeVol) return null;
                          return (
                            <div className="flex flex-col h-full">
                              <div className="p-4 border-b border-gray-800 flex items-center gap-4">
                                <input
                                  value={activeVol.title}
                                  onChange={(e) => {
                                    const updated = activeIdea.volumes!.map(v => v.id === activeVol.id ? { ...v, title: e.target.value } : v);
                                    onUpdateIdea(activeIdea.id, { volumes: updated });
                                  }}
                                  className="bg-transparent text-lg font-bold text-white focus:outline-none flex-1"
                                  placeholder="卷标题"
                                />
                                <button
                                  onClick={() => {
                                    if (!window.confirm('确定删除此卷吗？')) return;
                                    const updated = activeIdea.volumes!.filter(v => v.id !== activeVol.id);
                                    onUpdateIdea(activeIdea.id, { volumes: updated });
                                    setActiveVolumeId(updated[0]?.id || null);
                                  }}
                                  className="text-gray-500 hover:text-red-400"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <textarea
                                value={activeVol.summary}
                                onChange={(e) => {
                                  const updated = activeIdea.volumes!.map(v => v.id === activeVol.id ? { ...v, summary: e.target.value } : v);
                                  onUpdateIdea(activeIdea.id, { volumes: updated });
                                }}
                                className="flex-1 bg-transparent p-4 text-gray-300 resize-none focus:outline-none leading-relaxed custom-scrollbar"
                                placeholder="在此输入本卷的详细大纲..."
                              />
                              <div className="p-4 border-t border-gray-800 flex justify-end">
                                <button
                                  onClick={() => {
                                    setVolumeContent(activeVol.summary);
                                    setActiveStage('beats');
                                  }}
                                  className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md text-sm font-medium transition-colors"
                                >
                                  <ArrowRight className="w-4 h-4 mr-2" />
                                  拆分此卷细纲
                                </button>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                          请选择一个分卷
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 4: BEATS */}
              {activeStage === 'beats' && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Chapter Beats - Volume Split */}
                  <div>
                    <h3 className="text-lg font-bold text-green-400 flex items-center mb-6">
                      <FileText className="w-5 h-5 mr-2" /> 章节细纲拆分
                    </h3>

                    {/* Linked Book Context Option */}
                    {activeIdea.linkedBookId && (
                      <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-lg mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <LinkIcon className="w-5 h-5 text-indigo-400" />
                          <div>
                            <div className="text-sm font-medium text-indigo-300">
                              已关联作品: {books?.find(b => b.id === activeIdea.linkedBookId)?.title}
                            </div>
                            <div className="text-xs text-indigo-400/70 mt-1">
                              开启后，AI 将读取选中章节的内容作为前情提要，使生成的细纲更连贯。
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {useLinkedBookContext && (
                            <div className="relative">
                              <button
                                onClick={() => setIsMultiSelectOpen(!isMultiSelectOpen)}
                                className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1 min-w-[120px] flex items-center justify-between"
                              >
                                <span className="truncate max-w-[100px]">
                                  {linkedRefChapterIds.length > 0
                                    ? `已选 ${linkedRefChapterIds.length} 章`
                                    : '选择参考章节'}
                                </span>
                                <ChevronDown className="w-3 h-3 ml-1" />
                              </button>

                              {isMultiSelectOpen && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setIsMultiSelectOpen(false)} />
                                  <div className="absolute top-full left-0 mt-1 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                                    <div className="p-2 space-y-1">
                                      {books?.find(b => b.id === activeIdea.linkedBookId)?.chapters.map(c => (
                                        <label key={c.id} className="flex items-center p-2 hover:bg-gray-700 rounded cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={linkedRefChapterIds.includes(c.id)}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setLinkedRefChapterIds([...linkedRefChapterIds, c.id]);
                                              } else {
                                                setLinkedRefChapterIds(linkedRefChapterIds.filter(id => id !== c.id));
                                              }
                                            }}
                                            className="rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 mr-2"
                                          />
                                          <span className="text-xs text-gray-300 truncate">{c.title}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={useLinkedBookContext}
                              onChange={(e) => setUseLinkedBookContext(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            <span className="ml-3 text-sm font-medium text-gray-300">参考现有章节</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Volume Input Section */}
                    <div className="bg-green-900/10 border border-green-500/30 p-6 rounded-lg mb-6">
                      <div className="flex justify-between items-center mb-4">
                        <label className="text-sm font-medium text-green-300">输入卷大纲内容</label>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">拆分章数：</span>
                            <select
                              value={splitChapterCount}
                              onChange={(e) => setSplitChapterCount(Number(e.target.value))}
                              className="appearance-none bg-gray-800 border border-gray-700 text-gray-300 py-1 pl-2 pr-6 rounded text-xs focus:outline-none focus:border-green-500"
                            >
                              {[2, 3, 4, 5, 6, 7, 8, 10].map(n => (
                                <option key={n} value={n}>{n} 章</option>
                              ))}
                            </select>
                          </div>
                          <div className="text-xs text-gray-500">
                            下次从第 {(activeIdea.lastSplitChapterNum || 0) + 1} 章开始
                          </div>
                        </div>
                      </div>
                      {/* Volume Content Input */}
                      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 mb-6">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm font-medium text-gray-400">本卷剧情大纲</label>
                          {activeIdea.volumes && activeIdea.volumes.length > 0 && (
                            <select
                              onChange={(e) => {
                                const vol = activeIdea.volumes?.find(v => v.id === e.target.value);
                                if (vol) setVolumeContent(vol.summary);
                              }}
                              className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1"
                            >
                              <option value="">选择分卷导入...</option>
                              {activeIdea.volumes.map(v => (
                                <option key={v.id} value={v.id}>{v.title}</option>
                              ))}
                            </select>
                          )}
                        </div>
                        <textarea
                          value={volumeContent}
                          onChange={(e) => setVolumeContent(e.target.value)}
                          className="w-full h-40 bg-transparent border border-gray-700 rounded-md p-3 text-sm text-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                          placeholder="在此输入本卷的详细剧情大纲，AI将根据此内容拆分章节..."
                        />
                      </div>
                      <div className="flex justify-between items-center">
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
                        </div>
                        <button
                          onClick={handleSplitVolume}
                          disabled={!volumeContent.trim() || isGenerating}
                          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm flex items-center disabled:opacity-50 transition-colors"
                        >
                          {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                          拆分 {splitChapterCount} 章
                        </button>
                      </div>
                    </div>

                    {/* Tabs: Current Split / History */}
                    <div className="flex border-b border-gray-800 mb-4">
                      <button
                        onClick={() => setShowSplitHistory(false)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${!showSplitHistory
                          ? 'border-green-500 text-green-400'
                          : 'border-transparent text-gray-500 hover:text-gray-300'
                          }`}
                      >
                        <FileText className="w-4 h-4 inline mr-1" />
                        本次拆分 {currentSplit && `(${currentSplit.beats.length}章)`}
                      </button>
                      <button
                        onClick={() => setShowSplitHistory(true)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${showSplitHistory
                          ? 'border-green-500 text-green-400'
                          : 'border-transparent text-gray-500 hover:text-gray-300'
                          }`}
                      >
                        <History className="w-4 h-4 inline mr-1" />
                        历史拆分 ({activeIdea.beatsSplitHistory?.length || 0})
                      </button>
                    </div>

                    {/* Content */}
                    {!showSplitHistory ? (
                      // Current Split
                      currentSplit ? (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center mb-2">
                            <div className="text-xs text-gray-500">
                              第 {currentSplit.startChapter} - {currentSplit.startChapter + currentSplit.beats.length - 1} 章
                            </div>
                            {/* Push Button for Current Split */}
                            {activeIdea.linkedBookId && onPushChapters && (
                              <button
                                onClick={() => {
                                  const chapters = currentSplit.beats.map((beat, idx) => ({
                                    id: Date.now() + `_c${idx}`,
                                    title: beat.chapterTitle,
                                    summary: beat.summary,
                                    content: `【本章摘要】\n${beat.summary}\n\n【核心冲突】\n${beat.conflict}\n\n【出场人物】\n${beat.keyCharacters.join(', ')}\n\n(在此开始写作...)`
                                  }));
                                  onPushChapters(activeIdea.linkedBookId!, chapters);
                                }}
                                className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors"
                              >
                                <Upload className="w-3 h-3" />
                                推送到目录
                              </button>
                            )}
                          </div>
                          {currentSplit.beats.map((beat, idx) => (
                            <div key={idx} className="bg-gray-900 border border-gray-700 rounded-lg p-4 hover:border-green-500/50 transition-colors">
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-white">{beat.chapterTitle}</h4>
                                <span className="text-xs bg-green-900/30 px-2 py-1 rounded text-green-400">
                                  第 {currentSplit.startChapter + idx} 章
                                </span>
                              </div>
                              <p className="text-sm text-gray-400 mb-3">{beat.summary}</p>
                              <div className="flex gap-2 text-xs flex-wrap">
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
                      ) : (
                        <div className="text-center py-12 border-2 border-dashed border-gray-800 rounded-lg text-gray-600">
                          输入卷大纲内容后点击"拆分"按钮生成章节细纲
                        </div>
                      )
                    ) : (
                      // History
                      activeIdea.beatsSplitHistory && activeIdea.beatsSplitHistory.length > 0 ? (
                        <div className="space-y-4">
                          {activeIdea.beatsSplitHistory.map((split, splitIdx) => {
                            const isExpanded = expandedHistoryIds.includes(split.id);
                            return (
                              <div key={split.id} className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                                <div
                                  className="bg-gray-800/50 px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-gray-800 transition-colors"
                                  onClick={() => toggleHistoryExpand(split.id)}
                                >
                                  <div className="flex items-center gap-3">
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                                    <span className="text-sm font-medium text-gray-300">
                                      第 {split.startChapter} - {split.startChapter + split.beats.length - 1} 章
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      ({split.beats.length} 章)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                      <Clock className="w-3 h-3" />
                                      {new Date(split.createdAt).toLocaleString()}
                                    </div>
                                    {/* Push Button for History Item */}
                                    {activeIdea.linkedBookId && onPushChapters && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const chapters = split.beats.map((beat, idx) => ({
                                            id: Date.now() + `_c${idx}`,
                                            title: beat.chapterTitle,
                                            summary: beat.summary,
                                            content: `【本章摘要】\n${beat.summary}\n\n【核心冲突】\n${beat.conflict}\n\n【出场人物】\n${beat.keyCharacters.join(', ')}\n\n(在此开始写作...)`
                                          }));
                                          onPushChapters(activeIdea.linkedBookId!, chapters);
                                        }}
                                        className="text-gray-500 hover:text-indigo-400 transition-colors"
                                        title="推送到目录"
                                      >
                                        <Upload className="w-4 h-4" />
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteSplit(split.id);
                                      }}
                                      className="text-gray-500 hover:text-red-400 transition-colors"
                                      title="删除记录"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                {isExpanded && (
                                  <div className="p-4 space-y-3 border-t border-gray-800 animate-fadeIn">
                                    {split.beats.map((beat, idx) => (
                                      <div key={idx} className="bg-gray-900 border border-gray-700 rounded-lg p-3">
                                        <div className="flex justify-between items-start mb-1">
                                          <h4 className="font-medium text-white text-sm">{beat.chapterTitle}</h4>
                                          <span className="text-xs text-gray-500">第 {split.startChapter + idx} 章</span>
                                        </div>
                                        <p className="text-xs text-gray-400">{beat.summary}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-12 border-2 border-dashed border-gray-800 rounded-lg text-gray-600">
                          暂无历史拆分记录
                        </div>
                      )
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
      )
      }
      {/* Link Book Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-[500px] shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-800">
              <h3 className="text-xl font-bold text-white flex items-center">
                <LinkIcon className="w-5 h-5 mr-2 text-indigo-400" />
                关联作品
              </h3>
              <p className="text-sm text-gray-400 mt-2">
                将当前灵感与一个作品关联，以便在拆分细纲时参考作品进度，或直接将灵感转化为新作品。
              </p>
            </div>

            <div className="p-6 space-y-4">
              <button
                onClick={() => {
                  onConvertToBook(activeIdea);
                  setShowLinkModal(false);
                }}
                className="w-full p-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-lg flex items-center justify-between group transition-all"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-green-900/30 rounded-lg flex items-center justify-center mr-4 group-hover:bg-green-900/50 transition-colors">
                    <Plus className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-gray-200">创建新作品</div>
                    <div className="text-xs text-gray-500">使用当前灵感标题和设定创建一个全新的作品</div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-gray-300" />
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-800"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-gray-900 px-2 text-gray-500">或者关联现有作品</span>
                </div>
              </div>

              <div className="space-y-2">
                {books && books.length > 0 ? (
                  books.map(book => (
                    <button
                      key={book.id}
                      onClick={() => {
                        onUpdateIdea(activeIdea.id, { linkedBookId: book.id });
                        setShowLinkModal(false);
                      }}
                      className="w-full p-3 bg-gray-800/50 hover:bg-gray-800 border border-gray-800 hover:border-indigo-500/50 rounded-lg flex items-center justify-between group transition-all"
                    >
                      <div className="flex items-center">
                        <BookPlus className="w-4 h-4 text-indigo-400 mr-3" />
                        <span className="text-gray-300 font-medium">{book.title}</span>
                      </div>
                      {activeIdea.linkedBookId === book.id && (
                        <span className="text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded">已关联</span>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    书架上还没有作品
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-gray-950 border-t border-gray-800 flex justify-end">
              <button
                onClick={() => setShowLinkModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

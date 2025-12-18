import React, { useState, useEffect, useRef } from 'react';
import { IdeaProject, ChapterBeat, AppSettings, PromptTemplate, BeatsSplit, Book, Chapter, GenerationHistoryEntry } from '../types';
import { Lightbulb, Globe, List, FileText, Plus, ArrowRight, Wand2, Loader2, BookPlus, Trash2, ChevronDown, ChevronRight, ChevronUp, Cpu, History, Clock, Link as LinkIcon, Check, Upload } from 'lucide-react';
import { generateOutlineFromWorldview, generateChapterBeatsFromOutline, generateBeatsFromVolumeContent, generateVolumesFromOutline, generatePartsFromVolume, generateStorylineFromIdea, generateOutlineFromStoryline, generateStoryCoreAndSynopsis, generateDetailedWorldview } from '../services/geminiService';

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
  const [activeStage, setActiveStage] = useState<'spark' | 'world' | 'plot' | 'volume' | 'beats'>('spark');
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
  const [corePromptId, setCorePromptId] = useState<string>('default');
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

  const handleGenerateCoreAndSynopsis = async () => {
    if (!activeIdea || isGenerating) return;
    setIsGenerating(true);
    try {
      const customTemplate = corePromptId !== 'default' ? prompts.find(p => p.id === corePromptId)?.template : undefined;
      const defaultModel = settings.models?.find(m => m.id === settings.defaultModelId) || settings.models?.[0];
      if (!defaultModel) throw new Error('没有配置模型');
      const tempConfig = { ...defaultModel, modelName: stageModels.spark };

      const result = await generateStoryCoreAndSynopsis(
        tempConfig, 
        activeIdea.spark, 
        {
          length: activeIdea.storyLength,
          genre: activeIdea.storyGenre,
          background: activeIdea.storyBackground
        },
        customTemplate
      );

      const historyEntry: GenerationHistoryEntry = {
        id: Date.now().toString(),
        type: 'spark',
        content: `【故事内核】\n${result.core}\n\n【故事概要】\n${result.synopsis}`,
        prompt: customTemplate,
        model: tempConfig.modelName,
        createdAt: Date.now()
      };

      onUpdateIdea(activeIdea.id, { 
        storyCore: result.core, 
        storySynopsis: result.synopsis,
        generationHistory: [historyEntry, ...(activeIdea.generationHistory || [])]
      });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateDetailedBackground = async () => {
    if (!activeIdea || isGenerating) return;
    setIsGenerating(true);
    try {
      const defaultModel = settings.models?.find(m => m.id === settings.defaultModelId) || settings.models?.[0];
      if (!defaultModel) throw new Error('没有配置模型');
      const tempConfig = { ...defaultModel, modelName: stageModels.spark };

      const result = await generateDetailedWorldview(tempConfig, {
        storyLength: activeIdea.storyLength,
        core: activeIdea.storyCore,
        synopsis: activeIdea.storySynopsis,
        genre: activeIdea.storyGenre,
        background: activeIdea.storyBackground
      });

      const historyEntry: GenerationHistoryEntry = {
        id: Date.now().toString(),
        type: 'world',
        content: result,
        prompt: undefined, // Detailed worldview uses internal complex prompts usually, or add if passed
        model: tempConfig.modelName,
        createdAt: Date.now()
      };

      onUpdateIdea(activeIdea.id, { 
        worldview: result,
        generationHistory: [historyEntry, ...(activeIdea.generationHistory || [])]
      });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateStoryline = async () => {
    if (!activeIdea || isGenerating) return;
    setIsGenerating(true);
    try {
      const customTemplate = sparkPromptId !== 'default' ? prompts.find(p => p.id === sparkPromptId)?.template : undefined;
      const defaultModel = settings.models?.find(m => m.id === settings.defaultModelId) || settings.models?.[0];
      if (!defaultModel) throw new Error('没有配置模型');
      const tempConfig = { ...defaultModel, modelName: stageModels.spark };

      const result = await generateStorylineFromIdea(
        tempConfig, 
        activeIdea.spark, 
        activeIdea.storyCore, 
        activeIdea.storySynopsis, 
        customTemplate
      );

      const historyEntry: GenerationHistoryEntry = {
        id: Date.now().toString(),
        type: 'story',
        content: result,
        prompt: customTemplate,
        model: tempConfig.modelName,
        createdAt: Date.now()
      };

      onUpdateIdea(activeIdea.id, { 
        storyline: result,
        generationHistory: [historyEntry, ...(activeIdea.generationHistory || [])]
      });
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
      
      const historyEntry: GenerationHistoryEntry = {
        id: Date.now().toString(),
        type: 'outline',
        content: result,
        prompt: customTemplate,
        model: tempConfig.modelName,
        createdAt: Date.now()
      };

      onUpdateIdea(activeIdea.id, { 
        outline: result,
        generationHistory: [historyEntry, ...(activeIdea.generationHistory || [])]
      });
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
      
      const historyEntry: GenerationHistoryEntry = {
        id: Date.now().toString(),
        type: 'outline',
        content: result,
        prompt: customTemplate,
        model: tempConfig.modelName,
        createdAt: Date.now()
      };

      onUpdateIdea(activeIdea.id, { 
        outline: result,
        generationHistory: [historyEntry, ...(activeIdea.generationHistory || [])]
      });
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

      const historyEntry: GenerationHistoryEntry = {
        id: Date.now().toString(),
        type: 'volume',
        content: `【分卷生成】\n共生成 ${newVolumes.length} 卷\n` + newVolumes.map(v => `${v.title}: ${v.summary}`).join('\n'),
        prompt: customTemplate,
        model: tempConfig.modelName,
        createdAt: Date.now()
      };

      onUpdateIdea(activeIdea.id, { 
        volumes: newVolumes,
        generationHistory: [historyEntry, ...(activeIdea.generationHistory || [])]
      });
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

      const historyEntry: GenerationHistoryEntry = {
        id: Date.now().toString(),
        type: 'volume',
        content: `【分卷细化】\n卷ID: ${activeVol.title}\n` + newParts.map(p => `${p.title}: ${p.summary}`).join('\n'),
        prompt: customTemplate,
        model: tempConfig.modelName,
        createdAt: Date.now()
      };

      onUpdateIdea(activeIdea.id, { 
        volumes: updatedVolumes,
        generationHistory: [historyEntry, ...(activeIdea.generationHistory || [])]
      });
      if (newParts.length > 0) {
        setActivePartId(newParts[0].id);
      }
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const [splitMode, setSplitMode] = useState<'partial' | 'full'>('partial');

  const handleGenerateBeats = async () => {
    if (!activeIdea || isGenerating) return;
    setIsGenerating(true);
    try {
      const customTemplate = beatsPromptId !== 'default' ? prompts.find(p => p.id === beatsPromptId)?.template : undefined;
      const defaultModel = settings.models?.find(m => m.id === settings.defaultModelId) || settings.models?.[0];
      if (!defaultModel) throw new Error('没有配置模型');
      
      // Determine content source based on available data
      let sourceContent = activeIdea.outline;
      
      // If no outline but volume content is present (user pasted it), use that? 
      // Actually, 'Full Split' usually implies splitting the *entire* outline.
      // If the user wants to split the current input text into *all* chapters, we can pass volumeContent if outline is missing.
      if (!sourceContent && volumeContent) {
        sourceContent = volumeContent;
      }

      if (!sourceContent) throw new Error('请先生成全书大纲，或在下方输入框中输入内容。');

      const tempConfig = { ...defaultModel, modelName: stageModels.beats };

      // We might want to let user specify total chapters for full split too?
      // For now, let's assume the AI decides or we pass a hint if needed.
      // But `generateChapterBeatsFromOutline` usually just takes the outline.
      
      const result = await generateChapterBeatsFromOutline(tempConfig, sourceContent, customTemplate);
      
      // Update Idea with new beats (replacing old ones? or appending?)
      // "Full Split" implies overwriting or setting the canonical list.
      onUpdateIdea(activeIdea.id, { chapterBeats: result });
      
      // Also update history log for reference?
      const newSplit: BeatsSplit = {
        id: Date.now().toString(),
        volumeContent: "【全书拆分】\n" + sourceContent.slice(0, 200) + "...",
        chapterCount: result.length,
        startChapter: 1,
        beats: result,
        createdAt: Date.now()
      };
      
      const updatedHistory = [...(activeIdea.beatsSplitHistory || []), newSplit];

      const historyEntry: GenerationHistoryEntry = {
        id: Date.now().toString(),
        type: 'beats',
        content: `【全书细纲拆分】\n共生成 ${result.length} 章`,
        prompt: customTemplate,
        model: tempConfig.modelName,
        createdAt: Date.now()
      };

      onUpdateIdea(activeIdea.id, { 
        chapterBeats: result, 
        beatsSplitHistory: updatedHistory,
        lastSplitChapterNum: result.length,
        generationHistory: [historyEntry, ...(activeIdea.generationHistory || [])]
      });

      setCurrentSplit(newSplit);
      setShowSplitHistory(false);

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

      const historyEntry: GenerationHistoryEntry = {
        id: Date.now().toString(),
        type: 'beats',
        content: `【局部细纲拆分】\n起始章节: ${startChapter}\n生成章数: ${beats.length}\n输入内容摘要: ${volumeContent.slice(0, 100)}...`,
        prompt: customTemplate,
        model: modelConfig.modelName,
        createdAt: Date.now()
      };

      // Update idea with new split history and cumulative beats
      onUpdateIdea(activeIdea.id, {
        beatsSplitHistory: updatedHistory,
        lastSplitChapterNum: lastChapterNum,
        chapterBeats: [...(activeIdea.chapterBeats || []), ...beats],
        generationHistory: [historyEntry, ...(activeIdea.generationHistory || [])]
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

  // Helper for Prompt Selector UI
  const PromptSelector = ({ category, value, onChange }: { category: string, value: string, onChange: (id: string) => void }) => {
    const categoryPrompts = prompts.filter(p => p.category === category);
    
    return (
      <div className="relative group">
        <Wand2 className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-purple-500 pointer-events-none" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded py-2 pl-8 pr-8 w-32 focus:outline-none focus:border-purple-500 hover:border-gray-600 transition-colors truncate cursor-pointer"
          title="选择提示词模板"
        >
          <option value="default">默认模板</option>
          {categoryPrompts.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3 h-3 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    );
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

          {/* Stage Tabs */}
          <div className="flex border-b border-gray-800 bg-gray-900/10 px-4">
            {[
              { id: 'spark', label: '灵感', icon: Lightbulb },
              { id: 'world', label: '世界观', icon: Globe },
              { id: 'plot', label: '大纲', icon: ArrowRight },
              { id: 'volume', label: '分卷', icon: List },
              { id: 'beats', label: '细纲', icon: FileText },
            ].map(stage => (
              <button
                key={stage.id}
                onClick={() => setActiveStage(stage.id as any)}
                className={`flex items-center px-6 py-4 border-b-2 transition-all ${activeStage === stage.id
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
                  }`}
              >
                <stage.icon className="w-4 h-4 mr-2" />
                <span className="font-medium">{stage.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeStage === 'spark' && (
              <div className="p-8 max-w-5xl mx-auto space-y-8">
                {/* Spark Input */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-200 flex items-center">
                      <Lightbulb className="w-5 h-5 mr-2 text-yellow-500" />
                      核心灵感 (Spark)
                    </h3>
                    <div className="flex items-center gap-3">
                      <PromptSelector 
                        category="brainstorm" 
                        value={corePromptId} 
                        onChange={setCorePromptId} 
                      />
                      <ModelSelector stage="spark" />
                      <button
                        onClick={handleGenerateCoreAndSynopsis}
                        disabled={isGenerating || !activeIdea.spark.trim()}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
                      >
                        {isGenerating ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Wand2 className="w-4 h-4 mr-2" />
                        )}
                        生成故事内核
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={activeIdea.spark}
                    onChange={(e) => onUpdateIdea(activeIdea.id, { spark: e.target.value })}
                    placeholder="输入一个核心脑洞、一句歌词、一个画面或是一个模糊的设想..."
                    className="w-full h-32 bg-gray-900 border border-gray-800 rounded-xl p-4 text-gray-200 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none leading-relaxed"
                  />

                  {/* Story Options */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">故事篇幅</label>
                      <select
                        value={activeIdea.storyLength || 'long'}
                        onChange={(e) => onUpdateIdea(activeIdea.id, { storyLength: e.target.value as 'short' | 'long' })}
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50"
                      >
                        <option value="long">长篇小说 (Long)</option>
                        <option value="short">短篇故事 (Short)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">故事类型</label>
                      <select
                        value={activeIdea.storyGenre || ''}
                        onChange={(e) => onUpdateIdea(activeIdea.id, { storyGenre: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50"
                      >
                        <option value="">请选择类型...</option>
                        {settings.genres?.map(genre => (
                          <option key={genre} value={genre}>{genre}</option>
                        ))}
                        {activeIdea.storyGenre && !settings.genres?.includes(activeIdea.storyGenre) && (
                          <option value={activeIdea.storyGenre}>{activeIdea.storyGenre} (自定义)</option>
                        )}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">故事背景</label>
                      <select
                        value={activeIdea.storyBackground || ''}
                        onChange={(e) => onUpdateIdea(activeIdea.id, { storyBackground: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50"
                      >
                        <option value="">请选择背景...</option>
                        {settings.backgrounds?.map(bg => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                        {activeIdea.storyBackground && !settings.backgrounds?.includes(activeIdea.storyBackground) && (
                          <option value={activeIdea.storyBackground}>{activeIdea.storyBackground} (自定义)</option>
                        )}
                      </select>
                    </div>
                  </div>
                </section>

                <div className="flex flex-col gap-8">
                  {/* Story Core */}
                  <section className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-200 flex items-center">
                      <Cpu className="w-5 h-5 mr-2 text-purple-400" />
                      故事内核 (Core)
                    </h3>
                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 relative group">
                      <textarea
                        value={activeIdea.storyCore || ''}
                        onChange={(e) => onUpdateIdea(activeIdea.id, { storyCore: e.target.value })}
                        placeholder="生成的内核将显示在这里..."
                        className="w-full h-32 bg-transparent text-gray-300 focus:outline-none resize-none leading-relaxed"
                      />
                      {!activeIdea.storyCore && !isGenerating && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                           <Lightbulb className="w-12 h-12" />
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Story Synopsis */}
                  <section className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-200 flex items-center">
                      <History className="w-5 h-5 mr-2 text-blue-400" />
                      故事概要 (Synopsis)
                    </h3>
                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 relative">
                      <textarea
                        value={activeIdea.storySynopsis || ''}
                        onChange={(e) => onUpdateIdea(activeIdea.id, { storySynopsis: e.target.value })}
                        placeholder="生成的故事概要将显示在这里..."
                        className="w-full h-80 bg-transparent text-gray-300 focus:outline-none resize-none leading-relaxed"
                      />
                    </div>
                  </section>
                </div>
              </div>
            )}

            {activeStage === 'world' && (
              <div className="p-8 max-w-5xl mx-auto space-y-8">
                {/* Detailed Worldview/Background */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-200 flex items-center">
                      <Globe className="w-5 h-5 mr-2 text-green-400" />
                      详细背景/世界观 (Background)
                    </h3>
                    <button
                      onClick={handleGenerateDetailedBackground}
                      disabled={isGenerating || !activeIdea.storySynopsis}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg flex items-center text-sm font-medium transition-all"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Wand2 className="w-4 h-4 mr-2" />
                      )}
                      生成详细背景
                    </button>
                  </div>
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 relative">
                    <textarea
                      value={activeIdea.worldview || ''}
                      onChange={(e) => onUpdateIdea(activeIdea.id, { worldview: e.target.value })}
                      placeholder="点击按钮生成基于内核和概要的详细世界观、力量体系、地理环境等..."
                      className="w-full h-96 bg-transparent text-gray-300 focus:outline-none resize-none leading-relaxed"
                    />
                  </div>
                </section>
              </div>
            )}

            {activeStage === 'plot' && (
              <div className="p-8 max-w-5xl mx-auto space-y-8">
                {/* Storyline Section */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-200 flex items-center">
                      <ArrowRight className="w-5 h-5 mr-2 text-green-400" />
                      故事主线 (Storyline)
                    </h3>
                    <div className="flex items-center gap-3">
                      <ModelSelector stage="spark" />
                      <button
                        onClick={handleGenerateStoryline}
                        disabled={isGenerating || !activeIdea.spark.trim()}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
                      >
                        {isGenerating ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Wand2 className="w-4 h-4 mr-2" />
                        )}
                        生成故事线
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={activeIdea.storyline || ''}
                    onChange={(e) => onUpdateIdea(activeIdea.id, { storyline: e.target.value })}
                    placeholder="在这里描述故事的起承转合..."
                    className="w-full h-48 bg-gray-900 border border-gray-800 rounded-xl p-4 text-gray-200 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none leading-relaxed"
                  />
                </section>

                {/* Full Outline Section */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-200 flex items-center">
                      <Globe className="w-5 h-5 mr-2 text-indigo-400" />
                      全书大纲 (Outline)
                    </h3>
                    <div className="flex items-center gap-3">
                      <ModelSelector stage="story" />
                      <button
                        onClick={handleStorylineToOutline}
                        disabled={isGenerating || !activeIdea.storyline}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
                      >
                        {isGenerating ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Wand2 className="w-4 h-4 mr-2" />
                        )}
                        生成详细大纲
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={activeIdea.outline || ''}
                    onChange={(e) => onUpdateIdea(activeIdea.id, { outline: e.target.value })}
                    placeholder="详细的三幕式大纲或卷纲..."
                    className="w-full h-96 bg-gray-900 border border-gray-800 rounded-xl p-6 text-gray-200 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none leading-relaxed"
                  />
                </section>
              </div>
            )}
            {activeStage === 'volume' && (
              <div className="p-8 max-w-5xl mx-auto space-y-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center">
                      <List className="w-6 h-6 mr-2 text-indigo-400" />
                      分卷规划
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">将大纲拆分为具体的卷和部</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <ModelSelector stage="volume" />
                    <button
                      onClick={handleGenerateVolumes}
                      disabled={isGenerating || !activeIdea.outline}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg flex items-center text-sm font-medium transition-all"
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                      智能拆卷
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Volume List */}
                  <div className="md:col-span-1 space-y-3">
                    {activeIdea.volumes?.map((vol) => (
                      <button
                        key={vol.id}
                        onClick={() => setActiveVolumeId(vol.id)}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${activeVolumeId === vol.id
                          ? 'bg-indigo-600/10 border-indigo-500/50 text-indigo-400'
                          : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
                          }`}
                      >
                        <div className="text-xs opacity-50 mb-1">第 {vol.order} 卷</div>
                        <div className="font-bold truncate">{vol.title}</div>
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        const newVol = { id: Date.now().toString(), title: '新卷', summary: '', order: (activeIdea.volumes?.length || 0) + 1 };
                        onUpdateIdea(activeIdea.id, { volumes: [...(activeIdea.volumes || []), newVol] });
                        setActiveVolumeId(newVol.id);
                      }}
                      className="w-full p-4 rounded-xl border border-dashed border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700 flex items-center justify-center transition-all"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      添加分卷
                    </button>
                  </div>

                  {/* Volume Detail */}
                  <div className="md:col-span-2">
                    {activeVolumeId ? (
                      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                        <div className="p-6 border-b border-gray-800 bg-gray-900/50">
                          <input
                            value={activeIdea.volumes?.find(v => v.id === activeVolumeId)?.title || ''}
                            onChange={(e) => {
                              const updated = activeIdea.volumes?.map(v => v.id === activeVolumeId ? { ...v, title: e.target.value } : v);
                              onUpdateIdea(activeIdea.id, { volumes: updated });
                            }}
                            className="bg-transparent text-xl font-bold text-white focus:outline-none w-full"
                            placeholder="分卷标题"
                          />
                        </div>
                        <div className="p-6 space-y-6">
                          <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">本卷概要</label>
                            <textarea
                              value={activeIdea.volumes?.find(v => v.id === activeVolumeId)?.summary || ''}
                              onChange={(e) => {
                                const updated = activeIdea.volumes?.map(v => v.id === activeVolumeId ? { ...v, summary: e.target.value } : v);
                                onUpdateIdea(activeIdea.id, { volumes: updated });
                              }}
                              className="w-full h-48 bg-gray-950 border border-gray-800 rounded-xl p-4 text-gray-300 focus:outline-none focus:border-indigo-500/30 transition-colors resize-none leading-relaxed"
                              placeholder="输入本卷要讲述的核心故事..."
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-gray-800 rounded-2xl">
                        <List className="w-12 h-12 mb-4 opacity-10" />
                        <p>请选择或创建一个分卷</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {activeStage === 'beats' && (
              <div className="p-8 max-w-6xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center">
                      <FileText className="w-6 h-6 mr-2 text-indigo-400" />
                      细纲拆解
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">将大纲转化为具体的章节细纲</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <ModelSelector stage="beats" />
                    <button
                      onClick={handleGenerateBeats}
                      disabled={isGenerating || !activeIdea.outline}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg flex items-center text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                      智能拆分章节
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                  {/* Left: Input/Config Area */}
                  <div className="xl:col-span-1 space-y-6">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-300 flex items-center">
                          <Plus className="w-4 h-4 mr-2 text-indigo-400" />
                          拆分段落内容
                        </label>
                        <textarea
                          value={volumeContent}
                          onChange={(e) => setVolumeContent(e.target.value)}
                          placeholder="粘贴一段分卷大纲或剧情，将其拆分为章节..."
                          className="w-full h-48 bg-gray-950 border border-gray-800 rounded-xl p-4 text-xs text-gray-400 focus:outline-none focus:border-indigo-500/30 transition-colors resize-none"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-300">拆分章数</label>
                        <input
                          type="number"
                          value={splitChapterCount}
                          onChange={(e) => setSplitChapterCount(parseInt(e.target.value))}
                          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500/30"
                          min="1"
                          max="20"
                        />
                      </div>

                      <button
                        onClick={handleSplitVolume}
                        disabled={isGenerating || !volumeContent.trim()}
                        className="w-full py-3 bg-gray-800 hover:bg-gray-750 disabled:opacity-50 text-indigo-400 rounded-xl flex items-center justify-center font-medium transition-all border border-indigo-500/20"
                      >
                        {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                        执行局部拆分
                      </button>
                    </div>
                  </div>

                  {/* Right: Beats List */}
                  <div className="xl:col-span-3 space-y-4">
                    {activeIdea.chapterBeats && activeIdea.chapterBeats.length > 0 ? (
                      <div className="space-y-4">
                        {activeIdea.chapterBeats.map((beat, idx) => (
                          <div key={idx} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-colors group">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center">
                                <span className="w-8 h-8 bg-indigo-600/20 text-indigo-400 rounded-lg flex items-center justify-center font-bold text-xs mr-3">
                                  {idx + 1}
                                </span>
                                <input
                                  value={beat.chapterTitle}
                                  onChange={(e) => {
                                    const updated = [...activeIdea.chapterBeats!];
                                    updated[idx] = { ...beat, chapterTitle: e.target.value };
                                    onUpdateIdea(activeIdea.id, { chapterBeats: updated });
                                  }}
                                  className="bg-transparent text-lg font-bold text-gray-200 focus:outline-none"
                                />
                              </div>
                              <button
                                onClick={() => {
                                  const updated = activeIdea.chapterBeats!.filter((_, i) => i !== idx);
                                  onUpdateIdea(activeIdea.id, { chapterBeats: updated });
                                }}
                                className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-600 uppercase">剧情梗概</label>
                                <textarea
                                  value={beat.summary}
                                  onChange={(e) => {
                                    const updated = [...activeIdea.chapterBeats!];
                                    updated[idx] = { ...beat, summary: e.target.value };
                                    onUpdateIdea(activeIdea.id, { chapterBeats: updated });
                                  }}
                                  className="w-full bg-gray-950/50 border border-gray-800/50 rounded-xl p-3 text-sm text-gray-400 focus:outline-none focus:border-indigo-500/20 transition-colors resize-none h-24"
                                />
                              </div>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <label className="text-xs font-bold text-gray-600 uppercase">核心冲突</label>
                                  <input
                                    value={beat.conflict}
                                    onChange={(e) => {
                                      const updated = [...activeIdea.chapterBeats!];
                                      updated[idx] = { ...beat, conflict: e.target.value };
                                      onUpdateIdea(activeIdea.id, { chapterBeats: updated });
                                    }}
                                    className="w-full bg-gray-950/50 border border-gray-800/50 rounded-lg px-3 py-2 text-sm text-gray-400 focus:outline-none focus:border-indigo-500/20"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-bold text-gray-600 uppercase">出场角色</label>
                                  <input
                                    value={beat.keyCharacters.join(', ')}
                                    onChange={(e) => {
                                      const updated = [...activeIdea.chapterBeats!];
                                      updated[idx] = { ...beat, keyCharacters: e.target.value.split(',').map(s => s.trim()) };
                                      onUpdateIdea(activeIdea.id, { chapterBeats: updated });
                                    }}
                                    className="w-full bg-gray-950/50 border border-gray-800/50 rounded-lg px-3 py-2 text-sm text-gray-400 focus:outline-none focus:border-indigo-500/20"
                                    placeholder="逗号分隔角色名"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-96 flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-gray-800 rounded-3xl">
                        <FileText className="w-16 h-16 mb-4 opacity-10" />
                        <p className="text-lg">暂无章节细纲</p>
                        <p className="text-sm opacity-50 mt-1">点击上方按钮或在左侧输入内容开始拆分</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
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
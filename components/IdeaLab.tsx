import React, { useState, useEffect, useRef } from 'react';
import { IdeaProject, ChapterBeat, ChapterScene, AppSettings, PromptTemplate, BeatsSplit, Book, Chapter, GenerationHistoryEntry, CharacterProfile } from '../types';
import { Lightbulb, Globe, List, FileText, Plus, ArrowRight, Wand2, Loader2, BookPlus, Trash2, ChevronDown, ChevronRight, ChevronUp, Cpu, History, Clock, Link as LinkIcon, Check, Upload, Users, User, Maximize2, X, Eye, Star, ArrowUp, ArrowDown } from 'lucide-react';
import { generateOutlineFromWorldview, generateChapterBeatsFromOutline, generateBeatsFromVolumeContent, generateVolumesFromOutline, generatePartsFromVolume, generateStorylineFromIdea, generateOutlineFromStoryline, generateStoryCoreAndSynopsis, generateDetailedWorldview, generateCharactersFromIdea, generateCompleteOutline } from '../services/geminiService';

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
  const [activeStage, setActiveStage] = useState<'spark' | 'world' | 'character' | 'plot' | 'volume' | 'beats'>('spark');
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
    character: string;
  }>(() => {
    const defaultModel = settings.models?.find(m => m.id === settings.defaultModelId) || settings.models?.[0];
    const defaultModelName = defaultModel?.modelName || 'gemini-2.5-flash';
    return {
      spark: defaultModelName,
      story: defaultModelName,
      plot: defaultModelName,
      volume: defaultModelName,
      beats: defaultModelName,
      character: defaultModelName
    };
  });

  const [volumeContent, setVolumeContent] = useState('');
  const [splitChapterCount, setSplitChapterCount] = useState(3);
  const [startChapterNum, setStartChapterNum] = useState(1); // New state for start chapter
  const [showSplitHistory, setShowSplitHistory] = useState(false);
  const [currentSplit, setCurrentSplit] = useState<BeatsSplit | null>(null);

  // Linked Book Context State
  const [useLinkedBookContext, setUseLinkedBookContext] = useState(false);
  const [linkedRefChapterIds, setLinkedRefChapterIds] = useState<string[]>([]);
  const [isMultiSelectOpen, setIsMultiSelectOpen] = useState(false);

  // Character Generation Config
  const [charGenReqs, setCharGenReqs] = useState({
    protagonist: 1,
    antagonist: 1,
    supporting: 2
  });

  // Character Editing State
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);

  // Expanded states for history items
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<string[]>([]);
  const [expandedBeatIndices, setExpandedBeatIndices] = useState<number[]>([]);

  const toggleHistoryExpand = (id: string) => {
    setExpandedHistoryIds(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const toggleBeatExpand = (idx: number) => {
    setExpandedBeatIndices(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
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
  const [worldPromptId, setWorldPromptId] = useState<string>('default'); // For world generation
  const [worldviewPromptId, setWorldviewPromptId] = useState<string>('default'); // For detailed worldview
  const [outlinePromptId, setOutlinePromptId] = useState<string>('default'); // Used for re-generating Outline
  const [volumePromptId, setVolumePromptId] = useState<string>('default');
  const [beatsPromptId, setBeatsPromptId] = useState<string>('default');
  const [characterPromptId, setCharacterPromptId] = useState<string>('default');

  const [activeVolumeId, setActiveVolumeId] = useState<string | null>(null);

  // 章节卡片折叠状态（默认折叠，只显示标题）
  const [expandedChapterIndices, setExpandedChapterIndices] = useState<number[]>([]);

  // 切换章节卡片展开/折叠
  const toggleChapterExpand = (index: number) => {
    setExpandedChapterIndices(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  // 细纲分页和排序状态
  const [beatsCurrentPage, setBeatsCurrentPage] = useState(1);
  const [beatsPerPage, setBeatsPerPage] = useState(10); // 每页显示条数
  const [beatsSortOrder, setBeatsSortOrder] = useState<'asc' | 'desc'>('asc'); // 排序顺序

  // Initialize default prompts from localStorage or system defaults
  const hasInitializedPrompts = useRef(false);
  useEffect(() => {
    if (hasInitializedPrompts.current) return;
    if (prompts.length === 0) return;

    const initDefaultPrompt = (category: string, setter: (id: string) => void, storageKey: string) => {
      // First try to load from localStorage
      const savedPromptId = localStorage.getItem(storageKey);
      if (savedPromptId && prompts.find(p => p.id === savedPromptId)) {
        setter(savedPromptId);
        return;
      }

      // Fall back to system default
      const defaultPrompt = prompts.find(p => p.category === category && p.isDefault);
      if (defaultPrompt) {
        setter(defaultPrompt.id);
      }
    };

    initDefaultPrompt('brainstorm', setSparkPromptId, 'idealab_default_prompt_spark');
    initDefaultPrompt('brainstorm', setCorePromptId, 'idealab_default_prompt_core');
    initDefaultPrompt('outline', setStoryPromptId, 'idealab_default_prompt_story');
    initDefaultPrompt('world', setWorldviewPromptId, 'idealab_default_prompt_worldview');
    initDefaultPrompt('outline', setOutlinePromptId, 'idealab_default_prompt_outline');
    initDefaultPrompt('outline', setVolumePromptId, 'idealab_default_prompt_volume');
    initDefaultPrompt('beats', setBeatsPromptId, 'idealab_default_prompt_beats');
    initDefaultPrompt('character', setCharacterPromptId, 'idealab_default_prompt_character');

    hasInitializedPrompts.current = true;
  }, [prompts]);

  const activeIdea = ideas.find(i => i.id === activeIdeaId);

  const [activePartId, setActivePartId] = useState<string | null>(null);

  // Filter prompts by category
  const brainstormPrompts = prompts.filter(p => p.category === 'brainstorm');
  const worldPrompts = prompts.filter(p => p.category === 'world');
  const outlinePrompts = prompts.filter(p => p.category === 'outline');
  const beatsPrompts = prompts.filter(p => p.category === 'beats');

  // Linked Book Reference State (New)
  const [selectedRefChapterIds, setSelectedRefChapterIds] = useState<string[]>([]);
  const [showRefChapterSelector, setShowRefChapterSelector] = useState(false);

  // Helper to get linked book chapters
  const linkedBook = activeIdea && activeIdea.linkedBookId ? books.find(b => b.id === activeIdea.linkedBookId) : null;
  const availableRefChapters = linkedBook?.chapters || [];

  const toggleRefChapter = (id: string) => {
    setSelectedRefChapterIds(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  // Auto-calculate start chapter when active idea changes or sync data updates
  useEffect(() => {
    if (!activeIdea) return;

    // Only recalculate if we haven't manually set it (optional optimization, but here we sync with history)
    // Actually, we want to update it when we switch ideas.

    let next = (activeIdea.lastSplitChapterNum || 0) + 1;

    if (activeIdea.linkedBookId && books && books.length > 0) {
      const linkedBook = books.find(b => b.id === activeIdea.linkedBookId);
      if (linkedBook) {
        const bookNext = (linkedBook.chapters?.length || 0) + 1;
        if (bookNext > next) {
          next = bookNext;
        }
      }
    }
    setStartChapterNum(next);
  }, [activeIdea?.id, activeIdea?.lastSplitChapterNum, activeIdea?.linkedBookId, books]);

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
      const customTemplate = worldviewPromptId !== 'default' ? prompts.find(p => p.id === worldviewPromptId)?.template : undefined;
      const defaultModel = settings.models?.find(m => m.id === settings.defaultModelId) || settings.models?.[0];
      if (!defaultModel) throw new Error('没有配置模型');
      const tempConfig = { ...defaultModel, modelName: stageModels.story };

      const result = await generateDetailedWorldview(tempConfig, {
        storyLength: activeIdea.storyLength,
        core: activeIdea.storyCore,
        synopsis: activeIdea.storySynopsis,
        genre: activeIdea.storyGenre,
        background: activeIdea.storyBackground
      }, customTemplate);

      const historyEntry: GenerationHistoryEntry = {
        id: Date.now().toString(),
        type: 'world',
        content: result,
        prompt: customTemplate,
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

  const handleGenerateCharacters = async () => {
    if (!activeIdea || isGenerating) return;
    setIsGenerating(true);
    try {
      const customTemplate = characterPromptId !== 'default' ? prompts.find(p => p.id === characterPromptId)?.template : undefined;
      const defaultModel = settings.models?.find(m => m.id === settings.defaultModelId) || settings.models?.[0];
      if (!defaultModel) throw new Error('没有配置模型');
      const tempConfig = { ...defaultModel, modelName: stageModels.character };

      const result = await generateCharactersFromIdea(tempConfig, {
        spark: activeIdea.spark,
        core: activeIdea.storyCore,
        synopsis: activeIdea.storySynopsis,
        worldview: activeIdea.worldview,
        requirements: charGenReqs
      }, customTemplate);

      const newCharacters: CharacterProfile[] = result.map((c, idx) => ({
        ...c,
        id: Date.now().toString() + idx
      }));

      const historyEntry: GenerationHistoryEntry = {
        id: Date.now().toString(),
        type: 'character' as any, // Temporary cast as type might not be updated in GenerationHistoryEntry definition yet
        content: JSON.stringify(newCharacters, null, 2),
        prompt: customTemplate,
        model: tempConfig.modelName,
        createdAt: Date.now()
      };

      onUpdateIdea(activeIdea.id, {
        characters: [...(activeIdea.characters || []), ...newCharacters],
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

  const handleGenerateCompleteOutline = async () => {
    if (!activeIdea || isGenerating) return;
    setIsGenerating(true);
    try {
      const customTemplate = outlinePromptId !== 'default' ? prompts.find(p => p.id === outlinePromptId)?.template : undefined;
      const defaultModel = settings.models?.find(m => m.id === settings.defaultModelId) || settings.models?.[0];
      if (!defaultModel) throw new Error('没有配置模型');
      const tempConfig = { ...defaultModel, modelName: stageModels.story };

      // UPGRADE: Use generateCompleteOutline to fuse all contexts
      const result = await generateCompleteOutline(
        tempConfig,
        {
          spark: activeIdea.spark,
          core: activeIdea.storyCore,
          synopsis: activeIdea.storySynopsis,
          storyline: activeIdea.storyline, // Optional now
          worldview: activeIdea.worldview,
          characters: activeIdea.characters
        },
        customTemplate
      );

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

      const existingVolumes = activeIdea.volumes || [];
      const existingTitles = new Set(existingVolumes.map(v => v.title));

      const newVolumesData = volumesData.filter(v => !existingTitles.has(v.title));

      if (newVolumesData.length === 0 && volumesData.length > 0) {
        alert("未发现新分卷内容（所有识别到的分卷标题已存在）。");
        setIsGenerating(false);
        return;
      }

      const newVolumes = newVolumesData.map((v, idx) => ({
        id: Date.now().toString() + '_' + idx,
        title: v.title,
        summary: v.summary,
        order: existingVolumes.length + idx + 1
      }));

      const finalVolumes = [...existingVolumes, ...newVolumes];

      const historyEntry: GenerationHistoryEntry = {
        id: Date.now().toString(),
        type: 'volume',
        content: `【分卷提取】\n新增 ${newVolumes.length} 卷\n` + newVolumes.map(v => `${v.title}`).join('\n'),
        prompt: customTemplate,
        model: "Local Regex Extraction",
        createdAt: Date.now()
      };

      onUpdateIdea(activeIdea.id, {
        volumes: finalVolumes,
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

  const [splitMode, setSplitMode] = useState<'full' | 'selection'>('full');
  const [selectionRange, setSelectionRange] = useState<{ start: number, end: number }>({ start: 0, end: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTextareaSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    setSelectionRange({
      start: target.selectionStart,
      end: target.selectionEnd
    });
    // Automatically switch to selection mode if a significant selection is made
    if (target.selectionEnd - target.selectionStart > 5) {
      setSplitMode('selection');
    }
  };

  // New: Volume-based beats splitting
  const handleSplitVolume = async () => {
    if (!activeIdea || isGenerating || !volumeContent.trim()) return;

    let contentToProcess = volumeContent;

    if (splitMode === 'selection') {
      const { start, end } = selectionRange;
      if (end > start) {
        contentToProcess = volumeContent.substring(start, end);
      } else {
        alert(`请先在输入框中选中需要拆分的文字片段，或切换为"全部内容"模式。`);
        return;
      }
    }

    setIsGenerating(true);
    try {
      const modelConfig = settings.models?.find(m => m.id === settings.defaultModelId) || settings.models?.[0];
      if (!modelConfig) throw new Error('没有配置模型');

      const customTemplate = beatsPromptId !== 'default' ? beatsPrompts.find(p => p.id === beatsPromptId)?.template : undefined;

      // Use the user-configurable start chapter
      const startChapter = startChapterNum;

      // Extract Reference Context
      let referenceContext = '';
      if (linkedBook && selectedRefChapterIds.length > 0) {
        const selectedChapters = linkedBook.chapters.filter(c => selectedRefChapterIds.includes(c.id));
        // Sort by original order (assuming chapters array is ordered, or we could sort by index if needed)
        // Here we just keep the order found in chapters array which is usually chronological
        referenceContext = selectedChapters.map(c =>
          `### ${c.title}\n(概要: ${c.summary || '无'})\n${c.content ? c.content.slice(-1000) : ''}` // Take last 1000 chars of content for context
        ).join('\n\n');
      }

      const beats = await generateBeatsFromVolumeContent(
        { ...modelConfig, modelName: stageModels.beats },
        {
          volumeContent: contentToProcess,
          chapterCount: splitChapterCount,
          startChapter: startChapter,
          spark: activeIdea.spark,
          core: activeIdea.storyCore,
          synopsis: activeIdea.storySynopsis,
          worldview: activeIdea.worldview,
          characters: activeIdea.characters,
          referenceContext: referenceContext // Pass reference context
        },
        customTemplate
      );

      // Archive current beats to history if they exist (before replacing with new ones)
      let updatedHistory = [...(activeIdea.beatsSplitHistory || [])];
      if (activeIdea.chapterBeats && activeIdea.chapterBeats.length > 0) {
        // Create an archive entry from current beats
        const archivedSplit: BeatsSplit = {
          id: 'archived_' + Date.now().toString(),
          volumeContent: '（已归档的细纲，原始内容已推送或被新拆解替换）',
          chapterCount: activeIdea.chapterBeats.length,
          startChapter: activeIdea.lastSplitChapterNum
            ? activeIdea.lastSplitChapterNum - activeIdea.chapterBeats.length + 1
            : 1,
          beats: activeIdea.chapterBeats,
          createdAt: Date.now()
        };
        updatedHistory.push(archivedSplit);
      }

      const newSplit: BeatsSplit = {
        id: Date.now().toString(),
        volumeContent: contentToProcess, // Save only the processed part to history
        chapterCount: splitChapterCount,
        startChapter,
        beats,
        createdAt: Date.now()
      };

      // Add the new split to history as well for reference
      updatedHistory.push(newSplit);
      const lastChapterNum = startChapter + beats.length - 1;

      const historyEntry: GenerationHistoryEntry = {
        id: Date.now().toString(),
        type: 'beats',
        content: `【局部细纲拆分】\n起始章节: ${startChapter}\n生成章数: ${beats.length}\n输入内容摘要: ${volumeContent.slice(0, 100)}...`,
        prompt: customTemplate,
        model: modelConfig.modelName,
        createdAt: Date.now()
      };

      // Update idea: replace current beats with new ones (not cumulative anymore)
      onUpdateIdea(activeIdea.id, {
        beatsSplitHistory: updatedHistory,
        lastSplitChapterNum: lastChapterNum,
        chapterBeats: beats, // Replace instead of append
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

  const handlePushBeatsToBook = () => {
    if (!activeIdea || !activeIdea.chapterBeats || activeIdea.chapterBeats.length === 0) return;

    if (!activeIdea.linkedBookId) {
      if (window.confirm('当前灵感尚未关联作品。是否立即创建一个新作品并推送到其中？')) {
        onConvertToBook(activeIdea);
        // After conversion, the idea should be updated with linkedBookId, but we might need to wait or rely on user to click again.
        // For simplicity in this flow, onConvertToBook usually switches context or updates state.
        // But let's just alert user to try again after conversion logic handles it.
      }
      return;
    }

    if (!onPushChapters) {
      alert("无法推送到作品：功能未连接");
      return;
    }

    const newChapters: Chapter[] = activeIdea.chapterBeats.map((beat, idx) => {
      // Format scenes into content
      let content = '';
      if (beat.scenes && beat.scenes.length > 0) {
        content = beat.scenes.map(scene =>
          `### ${scene.sceneTitle} (${scene.wordCount})\n\n${scene.detail}`
        ).join('\n\n');
      } else {
        content = beat.summary || '';
      }

      // Add extra metadata to summary if needed
      const summary = beat.summary +
        (beat.conflict ? `\n\n【冲突】${beat.conflict}` : '') +
        (beat.keyCharacters.length > 0 ? `\n【角色】${beat.keyCharacters.join(', ')}` : '');

      return {
        id: Date.now().toString() + '_' + idx,
        title: beat.chapterTitle,
        summary: summary,
        content: content // Initial draft content from scenes
      };
    });

    if (window.confirm(`即将推送 ${newChapters.length} 个章节到关联作品。确定吗？`)) {
      onPushChapters(activeIdea.linkedBookId, newChapters);
      alert("章节已成功推送到作品目录！");
    }
  };

  // Push a single chapter beat to the linked book
  const handlePushSingleBeatToBook = (beatIndex: number) => {
    if (!activeIdea || !activeIdea.chapterBeats || beatIndex >= activeIdea.chapterBeats.length) return;

    if (!activeIdea.linkedBookId) {
      if (window.confirm('当前灵感尚未关联作品。是否立即创建一个新作品并推送到其中？')) {
        onConvertToBook(activeIdea);
      }
      return;
    }

    if (!onPushChapters) {
      alert("无法推送到作品：功能未连接");
      return;
    }

    const beat = activeIdea.chapterBeats[beatIndex];

    // Format scenes into content
    let content = '';
    if (beat.scenes && beat.scenes.length > 0) {
      content = beat.scenes.map(scene =>
        `### ${scene.sceneTitle} (${scene.wordCount})\n\n${scene.detail}`
      ).join('\n\n');
    } else {
      content = beat.summary || '';
    }

    // Add extra metadata to summary
    const summary = beat.summary +
      (beat.conflict ? `\n\n【冲突】${beat.conflict}` : '') +
      (beat.keyCharacters.length > 0 ? `\n【角色】${beat.keyCharacters.join(', ')}` : '');

    const newChapter: Chapter = {
      id: Date.now().toString(),
      title: beat.chapterTitle,
      summary: summary,
      content: content
    };

    if (window.confirm(`即将推送「${beat.chapterTitle}」到关联作品。确定吗？`)) {
      onPushChapters(activeIdea.linkedBookId, [newChapter]);
      alert(`「${beat.chapterTitle}」已成功推送到作品目录！`);
    }
  };

  // Helper for Prompt Selector UI - 优化版：支持预设分类过滤
  const PromptSelector = ({
    categories,
    value,
    onChange,
    storageKey,
    label = '提示词'
  }: {
    categories: string | string[], // 支持单个分类或多个分类
    value: string,
    onChange: (id: string) => void,
    storageKey?: string,
    label?: string
  }) => {
    // 将 categories 统一处理为数组
    const categoryArray = Array.isArray(categories) ? categories : [categories];

    // 过滤出所有匹配分类的提示词
    const filteredPrompts = prompts.filter(p => categoryArray.includes(p.category));
    const activePrompt = prompts.find(p => p.id === value);
    const [showPromptDetail, setShowPromptDetail] = useState(false);

    const handleSetDefault = () => {
      if (!storageKey || value === 'default') return;
      localStorage.setItem(storageKey, value);
      alert('已设为默认提示词！下次打开时将自动使用此提示词。');
    };

    return (
      <>
        <div className="relative group flex items-center gap-1">
          <div className="relative flex-1">
            <Wand2 className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-purple-500 pointer-events-none" />
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="appearance-none bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded py-2 pl-8 pr-8 w-32 focus:outline-none focus:border-purple-500 hover:border-gray-600 transition-colors truncate cursor-pointer"
              title={`选择${label}模板`}
            >
              <option value="default">默认模板</option>
              {filteredPrompts.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Eye Icon to View Prompt */}
          {value !== 'default' && activePrompt && (
            <button
              onClick={() => setShowPromptDetail(true)}
              className="p-1.5 text-gray-500 hover:text-purple-400 hover:bg-gray-700 rounded transition-colors shrink-0"
              title="查看提示词内容"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Set Default Button */}
          {storageKey && value !== 'default' && (
            <button
              onClick={handleSetDefault}
              className="p-1.5 text-gray-500 hover:text-green-400 hover:bg-gray-700 rounded transition-colors shrink-0"
              title="设为默认提示词"
            >
              <Star className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Prompt Detail Modal */}
        {showPromptDetail && activePrompt && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setShowPromptDetail(false)}>
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white">{activePrompt.name}</h3>
                  {activePrompt.description && (
                    <p className="text-xs text-gray-500 mt-1">{activePrompt.description}</p>
                  )}
                </div>
                <button
                  onClick={() => setShowPromptDetail(false)}
                  className="p-1 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed custom-scrollbar bg-gray-950 font-mono">
                {activePrompt.template}
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  // Helper for Model Selector UI
  const ModelSelector = ({ stage }: { stage: 'spark' | 'story' | 'plot' | 'volume' | 'beats' | 'character' }) => (
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
              { id: 'character', label: '人物小传', icon: Users },
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
                        categories="brainstorm"
                        value={corePromptId}
                        onChange={setCorePromptId}
                        storageKey="idealab_default_prompt_core"
                        label="脑洞"
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
                        className="w-full h-[400px] bg-transparent text-gray-300 focus:outline-none resize-none leading-relaxed"
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
                    <div className="flex items-center gap-3">
                      <PromptSelector
                        categories="world"
                        value={worldviewPromptId}
                        onChange={setWorldviewPromptId}
                        storageKey="idealab_default_prompt_worldview"
                        label="世界观"
                      />
                      <ModelSelector stage="story" />
                      <button
                        onClick={handleGenerateDetailedBackground}
                        disabled={isGenerating || !activeIdea.storySynopsis}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg flex items-center text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
                      >
                        {isGenerating ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Wand2 className="w-4 h-4 mr-2" />
                        )}
                        生成详细背景
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 relative">
                    <textarea
                      value={activeIdea.worldview || ''}
                      onChange={(e) => onUpdateIdea(activeIdea.id, { worldview: e.target.value })}
                      placeholder="点击按钮生成基于内核和概要的详细世界观、力量体系、地理环境等..."
                      className="w-full h-[700px] bg-transparent text-gray-300 focus:outline-none resize-none leading-relaxed"
                    />
                  </div>
                </section>
              </div>
            )}

            {activeStage === 'character' && (
              <div className="p-8 max-w-6xl mx-auto space-y-8">
                {/* Header & Controls */}
                <div className="flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-white flex items-center">
                        <Users className="w-6 h-6 mr-2 text-pink-400" />
                        人物小传
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">设计故事的核心角色，让人物活起来</p>
                    </div>
                  </div>

                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                    {/* Generation Settings */}
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">主角</label>
                        <input
                          type="number" min="0" max="10"
                          value={charGenReqs.protagonist}
                          onChange={(e) => setCharGenReqs(prev => ({ ...prev, protagonist: parseInt(e.target.value) || 0 }))}
                          className="w-12 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">反派</label>
                        <input
                          type="number" min="0" max="10"
                          value={charGenReqs.antagonist}
                          onChange={(e) => setCharGenReqs(prev => ({ ...prev, antagonist: parseInt(e.target.value) || 0 }))}
                          className="w-12 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">配角</label>
                        <input
                          type="number" min="0" max="10"
                          value={charGenReqs.supporting}
                          onChange={(e) => setCharGenReqs(prev => ({ ...prev, supporting: parseInt(e.target.value) || 0 }))}
                          className="w-12 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Action Area */}
                    <div className="flex items-center gap-3">
                      <PromptSelector
                        categories="character"
                        value={characterPromptId}
                        onChange={setCharacterPromptId}
                        storageKey="idealab_default_prompt_character"
                        label="人物"
                      />
                      <ModelSelector stage="character" />
                      <button
                        onClick={handleGenerateCharacters}
                        disabled={isGenerating || !activeIdea.spark.trim()}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg flex items-center text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
                      >
                        {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                        生成 (共 {charGenReqs.protagonist + charGenReqs.antagonist + charGenReqs.supporting} 人)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Character List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeIdea.characters?.map((char, idx) => (
                    <div key={char.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-colors group relative">
                      {/* Delete Button */}
                      <button
                        onClick={() => {
                          const updated = activeIdea.characters?.filter(c => c.id !== char.id);
                          onUpdateIdea(activeIdea.id, { characters: updated });
                        }}
                        className="absolute top-4 right-4 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {/* Name & Role */}
                      <div className="mb-4">
                        <input
                          value={char.name}
                          onChange={(e) => {
                            const updated = [...(activeIdea.characters || [])];
                            updated[idx] = { ...char, name: e.target.value };
                            onUpdateIdea(activeIdea.id, { characters: updated });
                          }}
                          className="bg-transparent text-lg font-bold text-white focus:outline-none w-full mb-1"
                          placeholder="角色姓名"
                        />
                        <input
                          value={char.role}
                          onChange={(e) => {
                            const updated = [...(activeIdea.characters || [])];
                            updated[idx] = { ...char, role: e.target.value };
                            onUpdateIdea(activeIdea.id, { characters: updated });
                          }}
                          className="bg-transparent text-xs text-pink-400 focus:outline-none w-full"
                          placeholder="角色定位 (主角/反派...)"
                        />
                      </div>

                      {/* Basic Info */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">性别</label>
                          <input
                            value={char.gender || ''}
                            onChange={(e) => {
                              const updated = [...(activeIdea.characters || [])];
                              updated[idx] = { ...char, gender: e.target.value };
                              onUpdateIdea(activeIdea.id, { characters: updated });
                            }}
                            className="w-full bg-gray-950/50 border border-gray-800/50 rounded px-2 py-1 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/30"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">年龄</label>
                          <input
                            value={char.age || ''}
                            onChange={(e) => {
                              const updated = [...(activeIdea.characters || [])];
                              updated[idx] = { ...char, age: e.target.value };
                              onUpdateIdea(activeIdea.id, { characters: updated });
                            }}
                            className="w-full bg-gray-950/50 border border-gray-800/50 rounded px-2 py-1 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/30"
                          />
                        </div>
                      </div>

                      {/* Description */}
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-bold text-gray-600 uppercase block mb-1">一句话介绍</label>
                          <textarea
                            value={char.description}
                            onChange={(e) => {
                              const updated = [...(activeIdea.characters || [])];
                              updated[idx] = { ...char, description: e.target.value };
                              onUpdateIdea(activeIdea.id, { characters: updated });
                            }}
                            className="w-full bg-gray-950/50 border border-gray-800/50 rounded-lg p-3 text-sm text-gray-400 focus:outline-none focus:border-indigo-500/20 transition-colors resize-none h-20"
                          />
                        </div>

                        <button
                          onClick={() => setEditingCharacterId(char.id)}
                          className="w-full py-2 flex items-center justify-center gap-2 text-xs text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg transition-all"
                        >
                          <Maximize2 className="w-3 h-3" />
                          编辑详细设定 (性格/外貌/背景)
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add New Character Button */}
                  <button
                    onClick={() => {
                      const newChar: CharacterProfile = {
                        id: Date.now().toString(),
                        name: '新角色',
                        role: '配角',
                        description: '',
                      };
                      onUpdateIdea(activeIdea.id, { characters: [...(activeIdea.characters || []), newChar] });
                    }}
                    className="border-2 border-dashed border-gray-800 rounded-2xl p-6 flex flex-col items-center justify-center text-gray-600 hover:text-gray-400 hover:border-gray-700 hover:bg-gray-900/30 transition-all min-h-[300px]"
                  >
                    <Plus className="w-12 h-12 mb-4 opacity-20" />
                    <span className="font-medium">手动添加角色</span>
                  </button>
                </div>

                {/* Character Edit Modal */}
                {editingCharacterId && (() => {
                  const char = activeIdea.characters?.find(c => c.id === editingCharacterId);
                  if (!char) return null;
                  return (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-8">
                      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900 z-10">
                          <div>
                            <h3 className="text-xl font-bold text-white">{char.name || '未命名角色'} - 详细设定</h3>
                            <p className="text-sm text-gray-500 mt-1">{char.role} · {char.gender} · {char.age}</p>
                          </div>
                          <button
                            onClick={() => setEditingCharacterId(null)}
                            className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-gray-950/50">
                          <div className="space-y-3">
                            <label className="flex items-center text-sm font-bold text-indigo-400 uppercase tracking-wider">
                              <User className="w-4 h-4 mr-2" />
                              性格特征
                            </label>
                            <textarea
                              value={char.personality || ''}
                              onChange={(e) => {
                                const updated = activeIdea.characters!.map(c => c.id === char.id ? { ...c, personality: e.target.value } : c);
                                onUpdateIdea(activeIdea.id, { characters: updated });
                              }}
                              className="w-full h-32 bg-gray-900 border border-gray-800 rounded-xl p-4 text-gray-300 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none leading-relaxed"
                              placeholder="描述角色的性格、习惯、说话方式..."
                            />
                          </div>

                          <div className="space-y-3">
                            <label className="flex items-center text-sm font-bold text-pink-400 uppercase tracking-wider">
                              <Maximize2 className="w-4 h-4 mr-2" />
                              外貌描写
                            </label>
                            <textarea
                              value={char.appearance || ''}
                              onChange={(e) => {
                                const updated = activeIdea.characters!.map(c => c.id === char.id ? { ...c, appearance: e.target.value } : c);
                                onUpdateIdea(activeIdea.id, { characters: updated });
                              }}
                              className="w-full h-32 bg-gray-900 border border-gray-800 rounded-xl p-4 text-gray-300 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none leading-relaxed"
                              placeholder="描述角色的外貌、穿着、体态..."
                            />
                          </div>

                          <div className="space-y-3">
                            <label className="flex items-center text-sm font-bold text-green-400 uppercase tracking-wider">
                              <History className="w-4 h-4 mr-2" />
                              背景故事
                            </label>
                            <textarea
                              value={char.background || ''}
                              onChange={(e) => {
                                const updated = activeIdea.characters!.map(c => c.id === char.id ? { ...c, background: e.target.value } : c);
                                onUpdateIdea(activeIdea.id, { characters: updated });
                              }}
                              className="w-full h-64 bg-gray-900 border border-gray-800 rounded-xl p-4 text-gray-300 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none leading-relaxed"
                              placeholder="描述角色的过去、经历、秘密..."
                            />
                          </div>
                        </div>

                        <div className="p-4 border-t border-gray-800 bg-gray-900 flex justify-end">
                          <button
                            onClick={() => setEditingCharacterId(null)}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20"
                          >
                            完成编辑
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {activeStage === 'plot' && (
              <div className="p-8 max-w-5xl mx-auto space-y-8">
                {/* Full Outline Section */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-200 flex items-center">
                      <Globe className="w-5 h-5 mr-2 text-indigo-400" />
                      全书大纲 (Outline)
                    </h3>
                    <div className="flex items-center gap-3">
                      <PromptSelector
                        categories="outline"
                        value={outlinePromptId}
                        onChange={setOutlinePromptId}
                        storageKey="idealab_default_prompt_outline"
                        label="大纲"
                      />
                      <ModelSelector stage="story" />
                      <button
                        onClick={handleGenerateCompleteOutline}
                        disabled={isGenerating}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
                      >
                        {isGenerating ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Wand2 className="w-4 h-4 mr-2" />
                        )}
                        生成全书大纲 (含主线与分卷)
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={activeIdea.outline || ''}
                    onChange={(e) => onUpdateIdea(activeIdea.id, { outline: e.target.value })}
                    placeholder="包含故事主线、分卷细纲及支线剧情..."
                    className="w-full h-[800px] bg-gray-900 border border-gray-800 rounded-xl p-6 text-gray-200 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none leading-relaxed"
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
                    <PromptSelector
                      categories="outline"
                      value={volumePromptId}
                      onChange={setVolumePromptId}
                      storageKey="idealab_default_prompt_volume"
                      label="分卷"
                    />
                    <ModelSelector stage="volume" />
                    <button
                      onClick={handleGenerateVolumes}
                      disabled={isGenerating || !activeIdea.outline}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg flex items-center text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
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
                        <div className="p-6 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between">
                          <input
                            value={activeIdea.volumes?.find(v => v.id === activeVolumeId)?.title || ''}
                            onChange={(e) => {
                              const updated = activeIdea.volumes?.map(v => v.id === activeVolumeId ? { ...v, title: e.target.value } : v);
                              onUpdateIdea(activeIdea.id, { volumes: updated });
                            }}
                            className="bg-transparent text-xl font-bold text-white focus:outline-none flex-1 mr-4"
                            placeholder="分卷标题"
                          />
                          <button
                            onClick={() => {
                              const vol = activeIdea.volumes?.find(v => v.id === activeVolumeId);
                              if (vol) {
                                setVolumeContent(vol.summary);
                                setActiveStage('beats');
                              }
                            }}
                            className="px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-600/20 rounded-lg text-xs font-medium flex items-center transition-all"
                            title="将本卷内容推送到细纲拆分页面"
                          >
                            <FileText className="w-3.5 h-3.5 mr-1.5" />
                            推送至细纲拆解
                          </button>
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
                              className="w-full h-[600px] bg-gray-950 border border-gray-800 rounded-xl p-4 text-gray-300 focus:outline-none focus:border-indigo-500/30 transition-colors resize-none leading-relaxed"
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
                    <PromptSelector
                      categories="beats"
                      value={beatsPromptId}
                      onChange={setBeatsPromptId}
                      storageKey="idealab_default_prompt_beats"
                      label="细纲"
                    />
                    <ModelSelector stage="beats" />
                    <button
                      onClick={handlePushBeatsToBook}
                      disabled={!activeIdea.chapterBeats || activeIdea.chapterBeats.length === 0}
                      className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center text-sm font-medium transition-all shadow-lg shadow-green-500/20"
                      title="将当前所有细纲章节推送到关联作品的目录中"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      推送至作品
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                  {/* Left: Input/Config Area */}
                  <div className="xl:col-span-1 space-y-6">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">

                      {/* Split Mode Selector */}
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-300 flex items-center justify-between">
                          <div className="flex items-center">
                            <Plus className="w-4 h-4 mr-2 text-indigo-400" />
                            拆解范围
                          </div>
                          {splitMode === 'selection' && (
                            <span className="text-xs text-indigo-400">
                              已选中 {selectionRange.end - selectionRange.start} 字
                            </span>
                          )}
                        </label>
                        <div className="flex bg-gray-950 p-1 rounded-lg border border-gray-800">
                          <button
                            onClick={() => setSplitMode('full')}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${splitMode === 'full'
                              ? 'bg-gray-800 text-white shadow-sm'
                              : 'text-gray-500 hover:text-gray-300'}`}
                          >
                            全部内容
                          </button>
                          <button
                            onClick={() => setSplitMode('selection')}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${splitMode === 'selection'
                              ? 'bg-gray-800 text-white shadow-sm'
                              : 'text-gray-500 hover:text-gray-300'}`}
                          >
                            选中片段
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <textarea
                          ref={textareaRef}
                          onSelect={handleTextareaSelect}
                          value={volumeContent}
                          onChange={(e) => setVolumeContent(e.target.value)}
                          placeholder="此处会自动填充从分卷推送的内容，您也可以手动粘贴一段剧情。选中部分文字可进行局部拆分。"
                          className={`w-full h-64 bg-gray-950 border rounded-xl p-4 text-xs text-gray-400 focus:outline-none transition-colors resize-none leading-relaxed ${splitMode === 'selection' && selectionRange.end > selectionRange.start
                            ? 'border-indigo-500/50'
                            : 'border-gray-800 focus:border-indigo-500/30'
                            }`}
                        />
                        {splitMode === 'selection' && selectionRange.end === selectionRange.start && (
                          <div className="text-xs text-yellow-500 flex items-center">
                            <span className="mr-1">⚠️</span> 请在上方输入框中用鼠标选中需要拆分的文字
                          </div>
                        )}
                      </div>

                      {/* Reference Chapter Selector (New) */}
                      {linkedBook && availableRefChapters.length > 0 && (
                        <div className="space-y-3 pt-3 border-t border-gray-800">
                          <label className="text-sm font-medium text-gray-300 flex items-center justify-between">
                            <div className="flex items-center">
                              <LinkIcon className="w-4 h-4 mr-2 text-indigo-400" />
                              参考书籍章节
                            </div>
                            <span className="text-xs text-gray-500">
                              已选 {selectedRefChapterIds.length} 章
                            </span>
                          </label>

                          <div className="space-y-2">
                            <button
                              onClick={() => setShowRefChapterSelector(!showRefChapterSelector)}
                              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-400 text-left flex items-center justify-between hover:border-gray-700 transition-colors"
                            >
                              <span>
                                {selectedRefChapterIds.length > 0
                                  ? `参考: ${availableRefChapters.find(c => c.id === selectedRefChapterIds[0])?.title.substring(0, 15)}... 等`
                                  : '点击选择参考章节 (可选)'}
                              </span>
                              {showRefChapterSelector ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>

                            {showRefChapterSelector && (
                              <div className="bg-gray-950 border border-gray-800 rounded-lg max-h-48 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                {availableRefChapters.slice().reverse().map(chapter => (
                                  <div
                                    key={chapter.id}
                                    onClick={() => toggleRefChapter(chapter.id)}
                                    className={`p-2 rounded cursor-pointer flex items-center gap-2 text-xs transition-colors ${selectedRefChapterIds.includes(chapter.id)
                                      ? 'bg-indigo-900/30 text-indigo-300'
                                      : 'hover:bg-gray-800 text-gray-400'
                                      }`}
                                  >
                                    <div className={`w-3 h-3 rounded border flex items-center justify-center ${selectedRefChapterIds.includes(chapter.id) ? 'bg-indigo-500 border-indigo-500' : 'border-gray-600'
                                      }`}>
                                      {selectedRefChapterIds.includes(chapter.id) && <Check className="w-2 h-2 text-white" />}
                                    </div>
                                    <span className="truncate">{chapter.title}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div className="space-y-3">
                          <label className="text-sm font-medium text-gray-300">起始章节号</label>
                          <input
                            type="number"
                            value={startChapterNum}
                            onChange={(e) => setStartChapterNum(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500/30 text-sm"
                            min="1"
                          />
                        </div>

                        <div className="space-y-3">
                          <label className="text-sm font-medium text-gray-300">预计拆分章数</label>
                          <input
                            type="number"
                            value={splitChapterCount}
                            onChange={(e) => setSplitChapterCount(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500/30 text-sm"
                            min="1"
                            max="50"
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleSplitVolume}
                        disabled={isGenerating || !volumeContent.trim() || (splitMode === 'selection' && selectionRange.end <= selectionRange.start)}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center font-medium transition-all shadow-lg shadow-indigo-500/20"
                      >
                        {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                        {splitMode === 'full' ? '拆解全部内容' : '拆解选中片段'}
                      </button>
                    </div>
                  </div>

                  {/* Right: Beats List */}
                  <div className="xl:col-span-3 space-y-4">
                    {activeIdea.chapterBeats && activeIdea.chapterBeats.length > 0 ? (
                      <>
                        {/* 控制栏：排序、每页显示条数 */}
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {/* 总数显示 */}
                            <div className="text-sm text-gray-400">
                              共 <span className="text-indigo-400 font-bold">{activeIdea.chapterBeats.length}</span> 个章节
                            </div>

                            {/* 排序按钮 */}
                            <button
                              onClick={() => setBeatsSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
                              title={beatsSortOrder === 'asc' ? '正序排列' : '倒序排列'}
                            >
                              {beatsSortOrder === 'asc' ? (
                                <>
                                  <ArrowUp className="w-3.5 h-3.5" />
                                  正序
                                </>
                              ) : (
                                <>
                                  <ArrowDown className="w-3.5 h-3.5" />
                                  倒序
                                </>
                              )}
                            </button>
                          </div>

                          {/* 每页显示条数 */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">每页显示</span>
                            <select
                              value={beatsPerPage}
                              onChange={(e) => {
                                setBeatsPerPage(Number(e.target.value));
                                setBeatsCurrentPage(1); // 重置到第一页
                              }}
                              className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500"
                            >
                              <option value={5}>5 条</option>
                              <option value={10}>10 条</option>
                              <option value={20}>20 条</option>
                              <option value={50}>50 条</option>
                              <option value={100}>100 条</option>
                              <option value={activeIdea.chapterBeats.length}>全部</option>
                            </select>
                          </div>
                        </div>

                        {/* 章节列表 */}
                        <div className="space-y-4">
                          {(() => {
                            // 排序逻辑
                            const sortedBeats = [...activeIdea.chapterBeats];
                            if (beatsSortOrder === 'desc') {
                              sortedBeats.reverse();
                            }

                            // 分页逻辑
                            const totalPages = Math.ceil(sortedBeats.length / beatsPerPage);
                            const startIndex = (beatsCurrentPage - 1) * beatsPerPage;
                            const endIndex = startIndex + beatsPerPage;
                            const paginatedBeats = sortedBeats.slice(startIndex, endIndex);

                            return paginatedBeats.map((beat, displayIdx) => {
                              // 计算原始索引（用于更新数据）
                              const originalIdx = beatsSortOrder === 'asc'
                                ? startIndex + displayIdx
                                : activeIdea.chapterBeats!.length - 1 - (startIndex + displayIdx);

                              const isChapterExpanded = expandedChapterIndices.includes(originalIdx);

                              return (
                                <div key={originalIdx} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-colors group">
                                  {/* 章节标题栏 - 始终显示 */}
                                  <div
                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-800/50 transition-colors"
                                    onClick={() => toggleChapterExpand(originalIdx)}
                                  >
                                    <div className="flex items-center flex-1 min-w-0">
                                      <span className="w-8 h-8 bg-indigo-600/20 text-indigo-400 rounded-lg flex items-center justify-center font-bold text-xs mr-3 shrink-0">
                                        {originalIdx + 1}
                                      </span>
                                      <input
                                        value={beat.chapterTitle}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const updated = [...activeIdea.chapterBeats!];
                                          updated[originalIdx] = { ...beat, chapterTitle: e.target.value };
                                          onUpdateIdea(activeIdea.id, { chapterBeats: updated });
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="bg-transparent text-lg font-bold text-gray-200 focus:outline-none flex-1 min-w-0"
                                        placeholder="章节标题"
                                      />
                                    </div>

                                    <div className="flex items-center gap-2 ml-4">
                                      {/* 操作按钮 */}
                                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {activeIdea.linkedBookId && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handlePushSingleBeatToBook(originalIdx);
                                            }}
                                            className="text-gray-500 hover:text-green-400 transition-colors p-1"
                                            title="推送此章节到作品"
                                          >
                                            <Upload className="w-4 h-4" />
                                          </button>
                                        )}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const updated = activeIdea.chapterBeats!.filter((_, i) => i !== originalIdx);
                                            onUpdateIdea(activeIdea.id, { chapterBeats: updated });
                                          }}
                                          className="text-gray-600 hover:text-red-400 transition-colors p-1"
                                          title="删除此章节"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>

                                      {/* 展开/折叠图标 */}
                                      <div className="text-gray-500">
                                        {isChapterExpanded ? (
                                          <ChevronUp className="w-5 h-5" />
                                        ) : (
                                          <ChevronDown className="w-5 h-5" />
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* 章节详细内容 - 折叠/展开 */}
                                  {isChapterExpanded && (
                                    <div className="px-6 pb-6 animate-in fade-in slide-in-from-top-2 duration-200">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                          <label className="text-xs font-bold text-gray-600 uppercase">剧情梗概</label>
                                          <textarea
                                            value={beat.summary}
                                            onChange={(e) => {
                                              const updated = [...activeIdea.chapterBeats!];
                                              updated[originalIdx] = { ...beat, summary: e.target.value };
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
                                                updated[originalIdx] = { ...beat, conflict: e.target.value };
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
                                                updated[originalIdx] = { ...beat, keyCharacters: e.target.value.split(',').map(s => s.trim()) };
                                                onUpdateIdea(activeIdea.id, { chapterBeats: updated });
                                              }}
                                              className="w-full bg-gray-950/50 border border-gray-800/50 rounded-lg px-3 py-2 text-sm text-gray-400 focus:outline-none focus:border-indigo-500/20"
                                              placeholder="逗号分隔角色名"
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      {/* Scene Breakdown - 保持现有不变 */}
                                      {beat.scenes && beat.scenes.length > 0 && (
                                        <div className="mt-6 border-t border-gray-800 pt-4">
                                          <button
                                            onClick={() => toggleBeatExpand(originalIdx)}
                                            className="w-full h-4 text-xs font-bold text-gray-500 uppercase mb-3 flex items-center justify-between hover:text-gray-300 transition-colors group"
                                          >
                                            <div className="flex items-center">
                                              <List className="w-3 h-3 mr-1.5" />
                                              场景细化
                                              <span className="ml-2 text-[10px] lowercase font-normal opacity-50 group-hover:opacity-100 italic">
                                                ({beat.scenes.length} 个场景)
                                              </span>
                                            </div>
                                            {expandedBeatIndices.includes(originalIdx) ? (
                                              <ChevronUp className="w-3 h-3" />
                                            ) : (
                                              <ChevronDown className="w-3 h-3" />
                                            )}
                                          </button>

                                          {expandedBeatIndices.includes(originalIdx) && (
                                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                              <textarea
                                                value={beat.scenes.map((scene, sIdx) =>
                                                  `场景${sIdx + 1}：${scene.sceneTitle} (${scene.wordCount})\n${scene.detail}`
                                                ).join('\n\n')}
                                                onChange={(e) => {
                                                  const text = e.target.value;
                                                  // 解析文本回场景数组
                                                  const sceneBlocks = text.split(/\n\n+/);
                                                  const newScenes = sceneBlocks.map(block => {
                                                    const lines = block.trim().split('\n');
                                                    if (lines.length === 0) return null;

                                                    const firstLine = lines[0];
                                                    // 匹配 "场景X：标题 (字数)" 格式
                                                    const match = firstLine.match(/^场景\d+[：:]\s*(.+?)\s*\((.+?)\)\s*$/);

                                                    if (match) {
                                                      return {
                                                        sceneTitle: match[1].trim(),
                                                        wordCount: match[2].trim(),
                                                        detail: lines.slice(1).join('\n').trim()
                                                      };
                                                    } else {
                                                      // 如果格式不匹配，尝试简单解析
                                                      return {
                                                        sceneTitle: firstLine.replace(/^场景\d+[：:]\s*/, '').trim(),
                                                        wordCount: '400字',
                                                        detail: lines.slice(1).join('\n').trim()
                                                      };
                                                    }
                                                  }).filter(s => s !== null) as ChapterScene[];

                                                  const updated = [...activeIdea.chapterBeats!];
                                                  updated[originalIdx] = { ...beat, scenes: newScenes };
                                                  onUpdateIdea(activeIdea.id, { chapterBeats: updated });
                                                }}
                                                className="w-full bg-gray-950/50 border border-gray-800/50 rounded-xl p-4 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/30 transition-colors resize-none leading-relaxed font-mono"
                                                rows={Math.max(8, beat.scenes.length * 3)}
                                                placeholder="场景1：场景标题 (400字)&#10;场景描述和关键线索...&#10;&#10;场景2：场景标题 (500字)&#10;场景描述..."
                                              />
                                              <p className="text-xs text-gray-600 mt-2 italic">
                                                💡 提示：每个场景用空行分隔，格式为"场景X：标题 (字数)"后跟描述
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>

                        {/* 分页控制器 */}
                        {(() => {
                          const totalPages = Math.ceil(activeIdea.chapterBeats.length / beatsPerPage);

                          if (totalPages <= 1) return null; // 只有一页时不显示分页

                          const renderPageNumbers = () => {
                            const pages = [];
                            const maxVisible = 7; // 最多显示7个页码

                            if (totalPages <= maxVisible) {
                              // 总页数少于最大显示数，显示所有页码
                              for (let i = 1; i <= totalPages; i++) {
                                pages.push(i);
                              }
                            } else {
                              // 总页数多，显示省略号
                              if (beatsCurrentPage <= 4) {
                                // 当前页在前面
                                for (let i = 1; i <= 5; i++) pages.push(i);
                                pages.push('...');
                                pages.push(totalPages);
                              } else if (beatsCurrentPage >= totalPages - 3) {
                                // 当前页在后面
                                pages.push(1);
                                pages.push('...');
                                for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
                              } else {
                                // 当前页在中间
                                pages.push(1);
                                pages.push('...');
                                for (let i = beatsCurrentPage - 1; i <= beatsCurrentPage + 1; i++) pages.push(i);
                                pages.push('...');
                                pages.push(totalPages);
                              }
                            }

                            return pages;
                          };

                          return (
                            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                              <div className="text-xs text-gray-500">
                                显示 {(beatsCurrentPage - 1) * beatsPerPage + 1} - {Math.min(beatsCurrentPage * beatsPerPage, activeIdea.chapterBeats.length)} / 共 {activeIdea.chapterBeats.length} 条
                              </div>

                              <div className="flex items-center gap-2">
                                {/* 上一页 */}
                                <button
                                  onClick={() => setBeatsCurrentPage(prev => Math.max(1, prev - 1))}
                                  disabled={beatsCurrentPage === 1}
                                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed border border-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
                                >
                                  上一页
                                </button>

                                {/* 页码 */}
                                <div className="flex items-center gap-1">
                                  {renderPageNumbers().map((page, idx) => {
                                    if (page === '...') {
                                      return (
                                        <span key={`ellipsis-${idx}`} className="px-2 text-gray-600">
                                          ...
                                        </span>
                                      );
                                    }

                                    return (
                                      <button
                                        key={page}
                                        onClick={() => setBeatsCurrentPage(page as number)}
                                        className={`min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors ${beatsCurrentPage === page
                                          ? 'bg-indigo-600 text-white'
                                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                                          }`}
                                      >
                                        {page}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* 下一页 */}
                                <button
                                  onClick={() => setBeatsCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                  disabled={beatsCurrentPage === totalPages}
                                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed border border-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
                                >
                                  下一页
                                </button>

                                {/* 跳转到页 */}
                                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-700">
                                  <span className="text-xs text-gray-500">跳转</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={totalPages}
                                    value={beatsCurrentPage}
                                    onChange={(e) => {
                                      const page = parseInt(e.target.value);
                                      if (page >= 1 && page <= totalPages) {
                                        setBeatsCurrentPage(page);
                                      }
                                    }}
                                    className="w-14 bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1 text-center focus:outline-none focus:border-indigo-500"
                                  />
                                  <span className="text-xs text-gray-500">/ {totalPages}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </>
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
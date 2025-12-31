import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Book, User, Send, Wand2, ChevronDown, ChevronRight, Cpu, X, Link, Plus, Copy, Check, RefreshCw, Eye, Star } from 'lucide-react';
import { Entity, EntityType, ChatMessage, PromptTemplate, PromptCategory, Chapter, ModelConfig } from '../types';
import { ChapterLinkModal, ChapterLink } from './ChapterLinkModal';

interface AIAssistantModalProps {
    isOpen: boolean;
    onClose: () => void;
    entities: Entity[];
    selectedEntityIds: string[];
    onToggleEntity: (id: string) => void;
    chapters?: Chapter[];
    activeChapterId?: string;
    chapterLinks?: ChapterLink[];
    onUpdateChapterLinks?: (links: ChapterLink[]) => void;
    onGenerate: (prompt: string, modelId?: string, category?: string) => Promise<void>;
    isGenerating: boolean;
    chatHistory: ChatMessage[];
    prompts: PromptTemplate[];
    models: ModelConfig[];
    defaultModelId?: string;
    onInsertToChapter?: (content: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
    drafting: '正文写作',
    refining: '润色优化',
    character: '角色设计',
    brainstorm: '脑洞灵感',
    world: '世界观',
    outline: '大纲',
    beats: '细纲',
    general: '通用',
};

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
    isOpen,
    onClose,
    entities,
    selectedEntityIds,
    onToggleEntity,
    chapters,
    activeChapterId,
    chapterLinks,
    onUpdateChapterLinks,
    onGenerate,
    isGenerating,
    chatHistory,
    prompts,
    models,
    defaultModelId,
    onInsertToChapter
}) => {
    const [promptInput, setPromptInput] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showCopySuccess, setShowCopySuccess] = useState(false);

    // 预设分类：写作区只显示写作相关的提示词
    const EDITOR_CATEGORIES: PromptCategory[] = ['drafting', 'refining', 'general'];

    // Prompt Selection State - 移除 selectedCategory，使用预设分类
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

    // Model Selection State
    const [selectedModel, setSelectedModel] = useState<string>(defaultModelId || (models[0]?.id || ''));

    // Initialize default prompt from localStorage
    useEffect(() => {
        if (prompts.length === 0 || !isOpen) return;

        // 尝试从 localStorage 加载上次使用的提示词
        const storageKey = 'editor_default_prompt';
        const savedPromptId = localStorage.getItem(storageKey);

        if (savedPromptId && prompts.find(p => p.id === savedPromptId && EDITOR_CATEGORIES.includes(p.category))) {
            setSelectedTemplateId(savedPromptId);
        } else {
            // 回退到系统默认（在预设分类中查找）
            const defaultPrompt = prompts.find(p => EDITOR_CATEGORIES.includes(p.category) && p.isDefault);
            if (defaultPrompt) {
                setSelectedTemplateId(defaultPrompt.id);
            }
        }
    }, [prompts, isOpen]);

    // Update selected model if default changes
    useEffect(() => {
        if (defaultModelId) {
            setSelectedModel(defaultModelId);
        }
    }, [defaultModelId]);

    // Chapter Link Modal State
    const [showChapterLinkModal, setShowChapterLinkModal] = useState(false);

    // Sidebar Sections State
    const [expandedSections, setExpandedSections] = useState({
        character: true,
        plot: true,
        world: true,
        chapter: true
    });

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Viewing Detail State
    const [viewingItem, setViewingItem] = useState<{ title: string; content: string } | null>(null);

    const chatEndRef = useRef<HTMLDivElement>(null);

    const characters = entities.filter(e => e.type === EntityType.CHARACTER);
    const worldItems = entities.filter(e => e.type === EntityType.WORLDVIEW);
    const plotItems = entities.filter(e =>
        (e.type === EntityType.PLOT || e.type === EntityType.IDEA) &&
        !['核心灵感 (Spark)', '故事主线'].includes(e.name)
    );

    // Filtered prompts for the dropdown - 使用预设分类过滤
    const filteredTemplates = prompts.filter(p => EDITOR_CATEGORIES.includes(p.category));

    const activeTemplate = prompts.find(p => p.id === selectedTemplateId);

    // History & Display State
    const [showHistory, setShowHistory] = useState(false);
    const [displayedMessage, setDisplayedMessage] = useState<ChatMessage | null>(null);

    // Only show AI responses (model messages)
    const aiResponses = chatHistory.filter(msg => msg.role === 'model');

    // Default Blank on Open
    useEffect(() => {
        if (isOpen) {
            setDisplayedMessage(null);
            setShowHistory(false);
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
    }, [isOpen]);

    // Update displayed message when new history arrives (Show Latest)
    // We track the last known ID to detect *new* messages
    const lastResponseIdRef = useRef<string | null>(null);

    useEffect(() => {
        const lastResponse = aiResponses[aiResponses.length - 1];
        if (lastResponse && lastResponse.id !== lastResponseIdRef.current) {
            setDisplayedMessage(lastResponse);
            lastResponseIdRef.current = lastResponse.id;
            // If generating, ensure we are not in history mode so user sees the result
            if (isGenerating) {
                setShowHistory(false);
            }
        }
    }, [aiResponses, isGenerating]);

    useEffect(() => {
        if (isOpen && !showHistory) {
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
    }, [isOpen, displayedMessage, showHistory]);

    const handleSend = () => {
        if (!promptInput.trim() && !selectedTemplateId) return;

        let finalPrompt = promptInput;

        if (selectedTemplateId && activeTemplate) {
            const templateText = activeTemplate.template;
            if (templateText.includes('{{input}}')) {
                finalPrompt = templateText.replace('{{input}}', promptInput);
            } else {
                if (promptInput.trim()) {
                    finalPrompt = `${templateText}\n\n${promptInput}`;
                } else {
                    finalPrompt = templateText;
                }
            }
        }

        // 使用提示词的分类（如果有）
        const category = activeTemplate?.category;

        onGenerate(finalPrompt, selectedModel, category || undefined);
        setPromptInput('');
    };

    const clearSelection = () => {
        setSelectedTemplateId('');
    };

    const handleInsert = (content: string) => {
        if (onInsertToChapter) {
            onInsertToChapter(content);
            onClose();
        }
    };

    const handleCopy = async (id: string, content: string) => {
        let success = false;
        try {
            await navigator.clipboard.writeText(content);
            success = true;
        } catch (err) {
            // Fallback for older browsers or non-secure contexts
            const textArea = document.createElement("textarea");
            textArea.value = content;
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.position = "fixed";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                success = document.execCommand('copy');
            } catch (e) {
                console.error('Copy failed', e);
            }
            document.body.removeChild(textArea);
        }

        if (success) {
            setCopiedId(id);
            setShowCopySuccess(true);
            setTimeout(() => {
                setCopiedId(null);
                setShowCopySuccess(false);
            }, 2000);
        }
    };

    const handleRegenerate = () => {
        // Find last user message
        // Ensure we are reading the USER'S instruction (prompt), NOT the AI's generated content.
        const lastUserMsg = [...chatHistory].reverse().find(m => m.role === 'user');
        if (!lastUserMsg) return;

        // Use current settings (model) for regeneration
        const category = activeTemplate?.category;
        onGenerate(lastUserMsg.text, selectedModel, category || undefined);
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-8">
                <div className="bg-gray-900 w-full max-w-6xl h-[85vh] rounded-xl shadow-2xl border border-gray-800 flex overflow-hidden flex-col md:flex-row">

                    {/* Left Sidebar: Context Settings */}
                    <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-gray-800 bg-gray-900/50 flex flex-col h-1/3 md:h-full relative">
                        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-300 flex items-center">
                                <Book className="w-4 h-4 mr-2 text-indigo-500" />
                                上下文配置
                            </h3>
                            {/* Mobile Close Button */}
                            <button
                                onClick={onClose}
                                disabled={isGenerating}
                                className="md:hidden text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {/* Characters Section */}
                            <div>
                                <button
                                    onClick={() => toggleSection('character')}
                                    className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 hover:text-gray-300"
                                >
                                    <div className="flex items-center">
                                        <User className="w-3 h-3 mr-1" /> 角色卡
                                    </div>
                                    {expandedSections.character ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                </button>
                                {expandedSections.character && (
                                    <div className="space-y-1 pl-2">
                                        {characters.length === 0 && <p className="text-xs text-gray-600 italic py-1">暂无角色</p>}
                                        {characters.map(char => (
                                            <div key={char.id} className="flex items-center justify-between group p-1.5 hover:bg-gray-800 rounded transition-colors">
                                                <label className="flex items-center cursor-pointer flex-1 min-w-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedEntityIds.includes(char.id)}
                                                        onChange={() => onToggleEntity(char.id)}
                                                        className="rounded bg-gray-700 border-gray-600 text-indigo-500 focus:ring-indigo-500/50"
                                                    />
                                                    <span className="ml-2 text-sm text-gray-300 group-hover:text-white truncate">{char.name}</span>
                                                </label>
                                                <button
                                                    onClick={() => setViewingItem({ title: char.name, content: char.content })}
                                                    className="p-1 text-gray-600 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="查看详情"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Plot/Story Section */}
                            <div>
                                <button
                                    onClick={() => toggleSection('plot')}
                                    className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 hover:text-gray-300"
                                >
                                    <div className="flex items-center">
                                        <Sparkles className="w-3 h-3 mr-1" /> 剧情/灵感
                                    </div>
                                    {expandedSections.plot ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                </button>
                                {expandedSections.plot && (
                                    <div className="space-y-1 pl-2">
                                        {plotItems.length === 0 && <p className="text-xs text-gray-600 italic py-1">暂无剧情设定</p>}
                                        {plotItems.map(item => (
                                            <div key={item.id} className="flex items-center justify-between group p-1.5 hover:bg-gray-800 rounded transition-colors">
                                                <label className="flex items-center cursor-pointer flex-1 min-w-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedEntityIds.includes(item.id)}
                                                        onChange={() => onToggleEntity(item.id)}
                                                        className="rounded bg-gray-700 border-gray-600 text-indigo-500 focus:ring-indigo-500/50"
                                                    />
                                                    <span className="ml-2 text-sm text-gray-300 group-hover:text-white truncate">{item.name}</span>
                                                </label>
                                                <button
                                                    onClick={() => setViewingItem({ title: item.name, content: item.content })}
                                                    className="p-1 text-gray-600 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="查看详情"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Worldview Section */}
                            <div>
                                <button
                                    onClick={() => toggleSection('world')}
                                    className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 hover:text-gray-300"
                                >
                                    <div className="flex items-center">
                                        <Book className="w-3 h-3 mr-1" /> 世界观
                                    </div>
                                    {expandedSections.world ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                </button>
                                {expandedSections.world && (
                                    <div className="space-y-1 pl-2">
                                        {worldItems.length === 0 && <p className="text-xs text-gray-600 italic py-1">暂无世界观</p>}
                                        {worldItems.map(item => (
                                            <div key={item.id} className="flex items-center justify-between group p-1.5 hover:bg-gray-800 rounded transition-colors">
                                                <label className="flex items-center cursor-pointer flex-1 min-w-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedEntityIds.includes(item.id)}
                                                        onChange={() => onToggleEntity(item.id)}
                                                        className="rounded bg-gray-700 border-gray-600 text-indigo-500 focus:ring-indigo-500/50"
                                                    />
                                                    <span className="ml-2 text-sm text-gray-300 group-hover:text-white truncate">{item.name}</span>
                                                </label>
                                                <button
                                                    onClick={() => setViewingItem({ title: item.name, content: item.content })}
                                                    className="p-1 text-gray-600 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="查看详情"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Chapters Section */}
                            {chapters && chapters.length > 1 && (
                                <div>
                                    <button
                                        onClick={() => toggleSection('chapter')}
                                        className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 hover:text-gray-300"
                                    >
                                        <div className="flex items-center">
                                            <Link className="w-3 h-3 mr-1" /> 关联章节
                                        </div>
                                        {expandedSections.chapter ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                    </button>

                                    {expandedSections.chapter && (
                                        <div className="space-y-2 pl-2 mt-1">
                                            <button
                                                onClick={() => setShowChapterLinkModal(true)}
                                                className="w-full text-left text-xs text-indigo-400 hover:text-indigo-300 hover:underline px-1"
                                            >
                                                + 选择关联章节
                                            </button>
                                            {chapterLinks && chapterLinks.length > 0 ? (
                                                <div className="space-y-1">
                                                    {chapterLinks.map(link => {
                                                        const chapter = chapters.find(c => c.id === link.chapterId);
                                                        if (!chapter) return null;
                                                        return (
                                                            <div key={link.chapterId} className="flex items-center justify-between p-2 bg-gray-800/50 rounded border border-gray-700 text-xs text-gray-300 group">
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="truncate block">{chapter.title}</span>
                                                                    <span className="text-gray-500 text-[10px]">{link.type === 'content' ? '正文' : '概要'}</span>
                                                                </div>
                                                                <button
                                                                    onClick={() => setViewingItem({
                                                                        title: chapter.title,
                                                                        content: link.type === 'content' ? chapter.content : (chapter.summary || '暂无概要')
                                                                    })}
                                                                    className="p-1 text-gray-600 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    title="查看内容"
                                                                >
                                                                    <Eye className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-600 italic px-1">未关联章节</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Detail View Modal (Overlay) */}
                        {viewingItem && (
                            <div className="absolute inset-0 z-50 bg-gray-900 border-r border-gray-800 flex flex-col animate-in slide-in-from-left-4 duration-200">
                                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/95 backdrop-blur-sm">
                                    <h3 className="font-bold text-gray-200 truncate pr-4">{viewingItem.title}</h3>
                                    <button
                                        onClick={() => setViewingItem(null)}
                                        className="p-1 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed custom-scrollbar bg-gray-950">
                                    {viewingItem.content || <span className="text-gray-600 italic">暂无内容</span>}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Main: Chat & Controls */}
                    <div className="flex-1 flex flex-col bg-gray-950 h-2/3 md:h-full relative">
                        {showCopySuccess && (
                            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[60] flex items-center bg-gray-800 text-white px-4 py-2 rounded-full shadow-xl border border-gray-700 animate-fadeIn transition-all">
                                <Check className="w-4 h-4 mr-2 text-green-500" />
                                <span className="text-sm font-medium">复制成功</span>
                            </div>
                        )}
                        {/* Header Controls */}
                        <div className="h-16 border-b border-gray-800 flex items-center justify-between px-4 gap-4 bg-gray-900/30">
                            <div className="flex items-center gap-2 flex-1">
                                {/* Model Selector */}
                                <div className="relative w-40 shrink-0">
                                    <Cpu className="w-3 h-3 text-gray-500 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    <select
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                        className="w-full appearance-none bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded py-1.5 pl-7 pr-6 focus:outline-none focus:border-indigo-500 truncate"
                                    >
                                        {models.map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="w-3 h-3 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>

                                {/* Template Selector - 移除分类选择，直接显示预设分类的提示词 */}
                                <div className="relative flex-1 min-w-0 flex items-center gap-1">
                                    <select
                                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                                        value={selectedTemplateId}
                                        className={`flex-1 appearance-none bg-gray-800 border text-gray-300 text-xs rounded py-1.5 pl-2 pr-6 focus:outline-none focus:border-indigo-500 truncate ${selectedTemplateId ? 'border-indigo-500 text-indigo-300' : 'border-gray-700'}`}
                                    >
                                        <option value="">选择写作指令...</option>
                                        {filteredTemplates.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="w-3 h-3 text-gray-500 absolute right-[72px] top-1/2 -translate-y-1/2 pointer-events-none" />

                                    {/* Eye Icon to View Prompt Template */}
                                    {selectedTemplateId && activeTemplate && (
                                        <button
                                            onClick={() => setViewingItem({
                                                title: `提示词: ${activeTemplate.name}`,
                                                content: activeTemplate.template
                                            })}
                                            className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-gray-700 rounded transition-colors shrink-0"
                                            title="查看提示词内容"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    )}

                                    {/* Set Default Button */}
                                    {selectedTemplateId && (
                                        <button
                                            onClick={() => {
                                                const storageKey = 'editor_default_prompt';
                                                localStorage.setItem(storageKey, selectedTemplateId);
                                                alert('已设为默认提示词！下次打开时将自动使用此提示词。');
                                            }}
                                            className="p-1.5 text-gray-500 hover:text-green-400 hover:bg-gray-700 rounded transition-colors shrink-0"
                                            title="设为默认提示词"
                                        >
                                            <Star className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className={`text-gray-500 hover:text-white hidden md:flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${showHistory ? 'bg-gray-800 text-white' : ''}`}
                                title={showHistory ? '返回生成页' : '查看历史记录'}
                            >
                                {showHistory ? <Sparkles className="w-4 h-4" /> : <Book className="w-4 h-4" />}
                                {showHistory ? '返回' : '历史'}
                            </button>

                            <button
                                onClick={onClose}
                                disabled={isGenerating}
                                className="text-gray-500 hover:text-white hidden md:block disabled:opacity-30 disabled:cursor-not-allowed"
                                title={isGenerating ? '生成中，请稍候...' : '关闭'}
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Active Template Indicator */}
                        {activeTemplate && (
                            <div className="px-4 py-2 bg-indigo-900/20 border-b border-indigo-500/20 flex justify-between items-center">
                                <span className="text-xs text-indigo-300 truncate flex items-center">
                                    <Wand2 className="w-3 h-3 mr-2" />
                                    当前模式: <strong className="ml-1">{activeTemplate.name}</strong>
                                    <span className="ml-2 opacity-70">- {activeTemplate.description}</span>
                                </span>
                                <button onClick={clearSelection} className="text-gray-500 hover:text-gray-300">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        )}

                        {/* AI Responses / Content Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-950 custom-scrollbar">

                            {/* Empty State (Only if no displayed message AND not generating AND not showing history) */}
                            {!displayedMessage && !isGenerating && !showHistory && (
                                <div className="flex flex-col items-center justify-center h-full text-gray-600 space-y-4">
                                    <div className="p-4 bg-gray-900 rounded-full">
                                        <Sparkles className="w-8 h-8 text-indigo-500" />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-lg font-medium text-gray-300">AI 写作助手</h3>
                                        <p className="text-sm mt-1 max-w-xs">选择左侧上下文，配置上方模型和提示词，开始辅助写作。</p>
                                    </div>
                                </div>
                            )}

                            {/* HISTORY VIEW: List all responses */}
                            {showHistory && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between text-xs text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">
                                        <span>历史生成记录 ({aiResponses.length})</span>
                                    </div>
                                    {aiResponses.map((msg, index) => (
                                        <div key={msg.id} className="bg-gray-800/30 border border-gray-800 hover:border-gray-700 rounded-lg overflow-hidden transition-colors group">
                                            {/* History Item Header */}
                                            <div className="flex items-center justify-between px-4 py-2 bg-gray-900/50 border-b border-gray-800">
                                                <span className="text-xs text-gray-500">
                                                    {new Date(msg.timestamp).toLocaleTimeString()}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        setDisplayedMessage(msg);
                                                        setShowHistory(false);
                                                    }}
                                                    className="text-xs text-indigo-400 hover:text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    查看此条
                                                </button>
                                            </div>
                                            {/* Preview Content */}
                                            <div className="p-3 text-sm text-gray-400 line-clamp-3">
                                                {msg.text}
                                            </div>
                                        </div>
                                    ))}
                                    {aiResponses.length === 0 && (
                                        <div className="text-center py-8 text-gray-600 italic">暂无历史记录</div>
                                    )}
                                </div>
                            )}

                            {/* SINGLE MESSAGE VIEW (Main) */}
                            {!showHistory && displayedMessage && (
                                <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden animate-fadeIn">
                                    {/* Response Header */}
                                    <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50 border-b border-gray-700">
                                        <span className="text-xs text-gray-500">
                                            {new Date(displayedMessage.timestamp).toLocaleTimeString()}
                                        </span>
                                        <span className="text-xs text-indigo-400 bg-indigo-900/20 px-2 py-0.5 rounded">
                                            最新生成
                                        </span>
                                    </div>
                                    {/* Response Content */}
                                    <div className="p-4 text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                                        {displayedMessage.text}
                                    </div>
                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-end gap-2 px-4 py-3 bg-gray-800/30 border-t border-gray-700">
                                        {!isGenerating && (
                                            <button
                                                onClick={handleRegenerate}
                                                className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors text-xs mr-auto"
                                                title="使用当前配置重新生成"
                                            >
                                                <RefreshCw className="w-4 h-4" />
                                                重新生成
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleCopy(displayedMessage.id, displayedMessage.text)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors text-xs"
                                        >
                                            {copiedId === displayedMessage.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                            {copiedId === displayedMessage.id ? '已复制' : '复制'}
                                        </button>
                                        {onInsertToChapter && (
                                            <button
                                                onClick={() => handleInsert(displayedMessage.text)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
                                                插入到章节
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {isGenerating && (
                                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    <span className="text-sm text-gray-500 ml-2">AI 正在思考生成中...</span>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 border-t border-gray-800 bg-gray-900">
                            <div className="relative">
                                <textarea
                                    value={promptInput}
                                    onChange={(e) => setPromptInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    placeholder={
                                        selectedTemplateId
                                            ? `输入内容（将自动填入"${activeTemplate?.name}"指令）...`
                                            : "输入对话或指令..."
                                    }
                                    className="w-full bg-gray-950 border border-gray-700 rounded-lg pl-4 pr-12 py-3 text-sm text-gray-200 focus:ring-1 focus:ring-indigo-500 outline-none resize-none h-24 custom-scrollbar placeholder-gray-600 transition-colors"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={isGenerating || (!promptInput.trim() && !selectedTemplateId)}
                                    className="absolute bottom-3 right-3 p-2 bg-indigo-600 hover:bg-indigo-500 rounded-md text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chapter Link Modal (Nested) */}
            {chapters && activeChapterId && (
                <ChapterLinkModal
                    isOpen={showChapterLinkModal}
                    onClose={() => setShowChapterLinkModal(false)}
                    chapters={chapters}
                    activeChapterId={activeChapterId}
                    selectedLinks={chapterLinks || []}
                    onSave={(links) => {
                        onUpdateChapterLinks?.(links);
                        setShowChapterLinkModal(false);
                    }}
                />
            )}
        </>
    );
};
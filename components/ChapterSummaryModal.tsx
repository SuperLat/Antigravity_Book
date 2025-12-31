import React, { useState, useEffect } from 'react';
import { X, Wand2, Loader2, ChevronDown, Cpu, Eye, Star } from 'lucide-react';
import { Chapter, PromptTemplate, PromptCategory, ModelConfig } from '../types';

interface ChapterSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    chapter: Chapter;
    prompts: PromptTemplate[];
    models: ModelConfig[];
    defaultModelId: string;
    onGenerateSummary: (chapterContent: string, modelId: string, promptTemplate?: string) => Promise<string>;
    onSaveSummary: (summary: string) => void;
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

export const ChapterSummaryModal: React.FC<ChapterSummaryModalProps> = ({
    isOpen,
    onClose,
    chapter,
    prompts,
    models,
    defaultModelId,
    onGenerateSummary,
    onSaveSummary,
}) => {
    const [summary, setSummary] = useState(chapter.summary || '');
    const [isGenerating, setIsGenerating] = useState(false);

    // 预设分类：章节概要主要使用润色和通用类提示词
    const SUMMARY_CATEGORIES: PromptCategory[] = ['refining', 'general'];

    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [selectedModelId, setSelectedModelId] = useState<string>(defaultModelId);
    const [viewingPrompt, setViewingPrompt] = useState<PromptTemplate | null>(null);

    // Sync state with props when modal opens or chapter changes
    useEffect(() => {
        if (isOpen) {
            setSummary(chapter.summary || '');
            setSelectedModelId(defaultModelId);
            setSelectedTemplateId('');
            setViewingPrompt(null);
        }
    }, [isOpen, chapter.id, chapter.summary, defaultModelId]);

    // Load default prompt when modal opens
    useEffect(() => {
        if (!isOpen || prompts.length === 0) return;

        const storageKey = 'summary_default_prompt';
        const savedPromptId = localStorage.getItem(storageKey);

        if (savedPromptId && prompts.find(p => p.id === savedPromptId && SUMMARY_CATEGORIES.includes(p.category))) {
            setSelectedTemplateId(savedPromptId);
        } else {
            // Fall back to system default
            const defaultPrompt = prompts.find(p => SUMMARY_CATEGORIES.includes(p.category) && p.isDefault);
            if (defaultPrompt) {
                setSelectedTemplateId(defaultPrompt.id);
            }
        }
    }, [prompts, isOpen]);

    if (!isOpen) return null;

    // 使用预设分类过滤提示词
    const filteredPrompts = prompts.filter(p => SUMMARY_CATEGORIES.includes(p.category));

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const selectedTemplate = selectedTemplateId
                ? prompts.find(p => p.id === selectedTemplateId)?.template
                : undefined;

            const generated = await onGenerateSummary(chapter.content, selectedModelId, selectedTemplate);
            setSummary(generated);
        } catch (error) {
            alert(`生成失败: ${(error as Error).message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = () => {
        onSaveSummary(summary);
        onClose();
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh]">

                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-800">
                        <div>
                            <h2 className="text-xl font-bold text-white">章节概要</h2>
                            <p className="text-sm text-gray-400 mt-1">{chapter.title || '未命名章节'}</p>
                        </div>
                        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-4">

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-300 mb-2">模型选择</label>
                                <div className="relative">
                                    <Cpu className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    <select
                                        value={selectedModelId}
                                        onChange={(e) => setSelectedModelId(e.target.value)}
                                        className="w-full appearance-none bg-gray-800 border border-gray-700 text-gray-300 py-2.5 pl-10 pr-10 rounded-lg text-sm focus:outline-none focus:border-indigo-500 hover:border-gray-600"
                                    >
                                        {models.map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-300 mb-2">提示词模板</label>
                                <div className="relative flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <select
                                            value={selectedTemplateId}
                                            onChange={(e) => setSelectedTemplateId(e.target.value)}
                                            className="w-full appearance-none bg-gray-800 border border-gray-700 text-gray-300 py-2.5 pl-3 pr-10 rounded-lg text-sm focus:outline-none focus:border-indigo-500 hover:border-gray-600"
                                        >
                                            <option value="">使用默认逻辑</option>
                                            {filteredPrompts.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>

                                    {/* Eye Icon to View Prompt */}
                                    {selectedTemplateId && (() => {
                                        const activeTemplate = prompts.find(p => p.id === selectedTemplateId);
                                        return activeTemplate ? (
                                            <button
                                                onClick={() => setViewingPrompt(activeTemplate)}
                                                className="p-2 text-gray-500 hover:text-indigo-400 hover:bg-gray-700 rounded transition-colors shrink-0"
                                                title="查看提示词内容"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        ) : null;
                                    })()}

                                    {/* Set Default Button */}
                                    {selectedTemplateId && (
                                        <button
                                            onClick={() => {
                                                const storageKey = 'summary_default_prompt';
                                                localStorage.setItem(storageKey, selectedTemplateId);
                                                alert('已设为默认提示词！下次打开时将自动使用此提示词。');
                                            }}
                                            className="p-2 text-gray-500 hover:text-green-400 hover:bg-gray-700 rounded transition-colors shrink-0"
                                            title="设为默认提示词"
                                        >
                                            <Star className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !chapter.content}
                            className="w-full flex items-center justify-center px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    生成中...
                                </>
                            ) : (
                                <>
                                    <Wand2 className="w-5 h-5 mr-2" />
                                    根据当前章节生成概要
                                </>
                            )}
                        </button>

                        {!chapter.content && (
                            <p className="text-sm text-yellow-500 text-center">
                                ⚠️ 章节内容为空，请先编写内容后再生成概要
                            </p>
                        )}

                        {/* Summary Textarea */}
                        <div>
                            <label className="block text-sm text-gray-300 mb-2">章节概要</label>
                            <textarea
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                className="w-full h-64 bg-gray-950 border border-gray-700 rounded-lg p-4 text-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none resize-none custom-scrollbar"
                                placeholder="在此输入或生成章节概要..."
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                概要将用于帮助 AI 理解故事脉络，建议简明扼要地总结本章核心内容
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-gray-800 flex justify-end space-x-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium"
                        >
                            保存概要
                        </button>
                    </div>
                </div>
            </div>

            {/* Prompt Detail Modal */}
            {viewingPrompt && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setViewingPrompt(null)}>
                    <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-white">{viewingPrompt.name}</h3>
                                {viewingPrompt.description && (
                                    <p className="text-xs text-gray-500 mt-1">{viewingPrompt.description}</p>
                                )}
                            </div>
                            <button
                                onClick={() => setViewingPrompt(null)}
                                className="p-1 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed custom-scrollbar bg-gray-950 font-mono">
                            {viewingPrompt.template}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

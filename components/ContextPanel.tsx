
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Book, User, Send, Wand2, ChevronDown, Cpu, X, Link } from 'lucide-react';
import { Entity, EntityType, ChatMessage, PromptTemplate, PromptCategory, Chapter, ModelConfig } from '../types';
import { ChapterLinkModal, ChapterLink } from './ChapterLinkModal';

interface ContextPanelProps {
  entities: Entity[];
  selectedEntityIds: string[];
  onToggleEntity: (id: string) => void;
  chapters?: Chapter[];
  activeChapterId?: string;
  chapterLinks?: ChapterLink[];
  onUpdateChapterLinks?: (links: ChapterLink[]) => void;
  onGenerate: (prompt: string, modelId?: string) => Promise<void>;
  isGenerating: boolean;
  chatHistory: ChatMessage[];
  prompts: PromptTemplate[];
  models: ModelConfig[];
  defaultModelId?: string;
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

export const ContextPanel: React.FC<ContextPanelProps> = ({
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
  defaultModelId
}) => {
  const [activeTab, setActiveTab] = useState<'context' | 'chat'>('context');
  const [promptInput, setPromptInput] = useState('');

  // Prompt Selection State
  const [selectedCategory, setSelectedCategory] = useState<PromptCategory | ''>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Model Selection State
  const [selectedModel, setSelectedModel] = useState<string>(defaultModelId || (models[0]?.id || ''));

  // Update selected model if default changes
  useEffect(() => {
    if (defaultModelId) {
      setSelectedModel(defaultModelId);
    }
  }, [defaultModelId]);

  // Chapter Link Modal State
  const [showChapterLinkModal, setShowChapterLinkModal] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const characters = entities.filter(e => e.type === EntityType.CHARACTER);
  const worldItems = entities.filter(e => e.type === EntityType.WORLDVIEW);

  // Filter prompts for "quick actions"
  const quickPrompts = prompts.filter(p => ['drafting', 'refining', 'general'].includes(p.category));

  // Filtered prompts for the dropdown
  const filteredTemplates = selectedCategory
    ? prompts.filter(p => p.category === selectedCategory)
    : [];

  const activeTemplate = prompts.find(p => p.id === selectedTemplateId);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSend = () => {
    // Allow sending if there is input OR if a template is selected (which might be a standalone command)
    if (!promptInput.trim() && !selectedTemplateId) return;

    let finalPrompt = promptInput;

    // Logic: If a template is selected, we wrap the input with it.
    if (selectedTemplateId && activeTemplate) {
      const templateText = activeTemplate.template;

      if (templateText.includes('{{input}}')) {
        // Merge input into placeholder
        finalPrompt = templateText.replace('{{input}}', promptInput);
      } else {
        // If no {{input}} placeholder, append input to the end if it exists
        // This handles templates like "Fix grammar" where user input is the target
        if (promptInput.trim()) {
          finalPrompt = `${templateText}\n\n${promptInput}`;
        } else {
          finalPrompt = templateText;
        }
      }
    }

    onGenerate(finalPrompt, selectedModel);
    setPromptInput('');
    // NOTE: selectedTemplateId is purposely NOT reset here, allowing continuous use of the same "mode"
    setActiveTab('chat');
  };

  const handlePresetClick = (template: PromptTemplate) => {
    // Quick action buttons: Set the category and template ID automatically
    setSelectedCategory(template.category);
    setSelectedTemplateId(template.id);
  };

  const clearSelection = () => {
    setSelectedTemplateId('');
    setSelectedCategory('');
  };

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full shadow-xl z-10">

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setActiveTab('context')}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center ${activeTab === 'context' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <Book className="w-4 h-4 mr-2" /> 上下文
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center ${activeTab === 'chat' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <Sparkles className="w-4 h-4 mr-2" /> AI 助手
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'context' ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="bg-indigo-900/20 p-3 rounded-lg border border-indigo-500/30 mb-4">
              <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wide mb-1">活跃记忆 (Context)</h3>
              <p className="text-xs text-indigo-200/70">
                勾选下方的条目，将其注入到 AI 的短期记忆中，以便生成符合设定的内容。
              </p>
            </div>

            {/* Characters Section */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center">
                <User className="w-3 h-3 mr-1" /> 角色卡
              </h3>
              <div className="space-y-1">
                {characters.map(char => (
                  <label key={char.id} className="flex items-start p-2 hover:bg-gray-800 rounded cursor-pointer group transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedEntityIds.includes(char.id)}
                      onChange={() => onToggleEntity(char.id)}
                      className="mt-1 rounded bg-gray-700 border-gray-600 text-indigo-500 focus:ring-indigo-500/50"
                    />
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-200 group-hover:text-white">{char.name}</div>
                      <div className="text-xs text-gray-500 line-clamp-1">{char.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Worldview Section */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center">
                <Book className="w-3 h-3 mr-1" /> 世界观
              </h3>
              <div className="space-y-1">
                {worldItems.map(item => (
                  <label key={item.id} className="flex items-start p-2 hover:bg-gray-800 rounded cursor-pointer group transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedEntityIds.includes(item.id)}
                      onChange={() => onToggleEntity(item.id)}
                      className="mt-1 rounded bg-gray-700 border-gray-600 text-indigo-500 focus:ring-indigo-500/50"
                    />
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-200 group-hover:text-white">{item.name}</div>
                      <div className="text-xs text-gray-500 line-clamp-1">{item.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Chapters Section */}
            {chapters && chapters.length > 1 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center">
                    <Book className="w-3 h-3 mr-1" /> 关联章节
                  </h3>
                  <button
                    onClick={() => setShowChapterLinkModal(true)}
                    className="flex items-center gap-1 px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded text-xs transition-colors"
                  >
                    <Link className="w-3 h-3" />
                    管理关联
                  </button>
                </div>

                {chapterLinks && chapterLinks.length > 0 ? (
                  <div className="space-y-1">
                    {chapterLinks.map(link => {
                      const chapter = chapters.find(c => c.id === link.chapterId);
                      if (!chapter) return null;

                      return (
                        <div key={link.chapterId} className="p-2 bg-gray-800/50 rounded border border-gray-700">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-200 truncate">{chapter.title}</div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {link.type === 'content' ? '📄 正文' : '📝 概要'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 text-center py-4">
                    暂无关联章节
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          /* AI Chat Tab */
          <div className="flex flex-col h-full">
            {/* Quick Actions */}
            <div className="p-3 border-b border-gray-800 bg-gray-900/50">
              <div className="text-[10px] text-gray-500 uppercase font-semibold mb-2">常用快捷指令</div>
              <div className="grid grid-cols-2 gap-2 max-h-24 overflow-y-auto custom-scrollbar">
                {quickPrompts.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetClick(preset)}
                    className={`px-2 py-1.5 border rounded text-xs text-left transition-colors flex items-center group ${selectedTemplateId === preset.id
                      ? 'bg-indigo-900/40 border-indigo-500/50 text-indigo-300'
                      : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300'
                      }`}
                    title={preset.description}
                  >
                    <Wand2 className={`w-3 h-3 mr-2 shrink-0 ${selectedTemplateId === preset.id ? 'text-indigo-400' : 'text-gray-500 group-hover:text-indigo-400'}`} />
                    <span className="truncate">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900">
              {chatHistory.length === 0 && (
                <div className="text-center text-gray-600 text-sm mt-10">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>选择上下文设定</p>
                  <p className="text-xs mt-1">输入内容，AI 将根据选中的指令进行处理</p>
                </div>
              )}
              {chatHistory.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-200 border border-gray-700'
                    }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isGenerating && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 flex items-center space-x-2">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-800 bg-gray-950">
              {/* Prompt & Model Selectors */}
              <div className="flex gap-2 p-2 bg-gray-900/50 border-b border-gray-800/50">
                <div className="relative flex-1">
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      const newCategory = e.target.value as PromptCategory;
                      setSelectedCategory(newCategory);

                      // Auto-select default prompt for this category
                      const defaultPrompt = prompts.find(p => p.category === newCategory && p.isDefault);
                      if (defaultPrompt) {
                        setSelectedTemplateId(defaultPrompt.id);
                      } else {
                        setSelectedTemplateId('');
                      }
                    }}
                    className="w-full appearance-none bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded py-1.5 pl-2 pr-6 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">分类...</option>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <div className="relative flex-1">
                  <select
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    value={selectedTemplateId}
                    disabled={!selectedCategory}
                    className={`w-full appearance-none bg-gray-800 border text-gray-300 text-xs rounded py-1.5 pl-2 pr-6 focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed ${selectedTemplateId ? 'border-indigo-500 text-indigo-300' : 'border-gray-700'}`}
                  >
                    <option value="">{selectedCategory ? '选择指令模板...' : '先选分类'}</option>
                    {filteredTemplates.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <div className="relative flex-1">
                  <Cpu className="w-3 h-3 text-gray-500 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full appearance-none bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded py-1.5 pl-6 pr-2 focus:outline-none focus:border-indigo-500 truncate"
                  >
                    {models.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Active Template Indicator (if selected) */}
              {activeTemplate && (
                <div className="px-3 py-1 bg-indigo-900/20 border-b border-indigo-500/20 flex justify-between items-center animate-in slide-in-from-top-1">
                  <span className="text-[10px] text-indigo-300 truncate">
                    <Wand2 className="w-3 h-3 inline mr-1" />
                    当前模式: <strong>{activeTemplate.name}</strong>
                  </span>
                  <button onClick={clearSelection} className="text-gray-500 hover:text-gray-300">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              <div className="relative p-3">
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
                      ? `输入内容（将自动填入“${activeTemplate?.name}”指令）...`
                      : "输入对话或指令..."
                  }
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg pl-3 pr-10 py-2 text-sm text-gray-200 focus:ring-1 focus:ring-indigo-500 outline-none resize-none h-20 custom-scrollbar placeholder-gray-600 transition-colors"
                />
                <button
                  onClick={handleSend}
                  disabled={isGenerating || (!promptInput.trim() && !selectedTemplateId)}
                  className="absolute bottom-5 right-5 p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-md text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chapter Link Modal */}
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
    </div>
  );
};

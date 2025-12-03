
import React, { useState, useEffect } from 'react';
import { PromptTemplate, PromptCategory } from '../types';
import { Terminal, Plus, Save, Trash2, Command, Check } from 'lucide-react';

interface PromptManagerProps {
  prompts: PromptTemplate[];
  onAddPrompt: (prompt: PromptTemplate) => void;
  onUpdatePrompt: (prompt: PromptTemplate) => void;
  onDeletePrompt: (id: string) => void;
}

const CATEGORIES: { value: PromptCategory; label: string }[] = [
  { value: 'brainstorm', label: '脑洞/灵感 (Brainstorm)' },
  { value: 'world', label: '世界观构建 (World)' },
  { value: 'outline', label: '大纲生成 (Outline)' },
  { value: 'beats', label: '细纲编排 (Chapter Beats)' },
  { value: 'character', label: '角色设计 (Character)' },
  { value: 'drafting', label: '正文写作 (Drafting)' },
  { value: 'refining', label: '润色优化 (Refining)' },
  { value: 'general', label: '通用指令 (General)' },
];

export const PromptManager: React.FC<PromptManagerProps> = ({
  prompts,
  onAddPrompt,
  onUpdatePrompt,
  onDeletePrompt
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<PromptCategory | 'all'>('all');
  const [showSaved, setShowSaved] = useState(false);

  // Initialize selection
  useEffect(() => {
    if (!selectedId && prompts.length > 0) {
      setSelectedId(prompts[0].id);
    }
  }, [prompts, selectedId]);

  // Handle deletion of currently selected prompt: if gone, select another
  useEffect(() => {
    if (selectedId && !prompts.find(p => p.id === selectedId)) {
      // Current selected was deleted, switch to first available or null
      setSelectedId(prompts.length > 0 ? prompts[0].id : null);
    }
  }, [prompts, selectedId]);

  const selectedPrompt = prompts.find(p => p.id === selectedId);

  const filteredPrompts = filter === 'all' 
    ? prompts 
    : prompts.filter(p => p.category === filter);

  const handleCreate = () => {
    const newPrompt: PromptTemplate = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5), // Ensure unique ID
      name: '新指令',
      description: '在此描述指令用途',
      template: '在此输入提示词模板...',
      category: 'general',
      isBuiltIn: false
    };
    onAddPrompt(newPrompt);
    setSelectedId(newPrompt.id);
  };

  const handleManualSave = () => {
    // Data is auto-saved via onUpdatePrompt -> App State -> LocalStorage
    // This just gives visual feedback
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const handleCopyVariable = (text: string) => {
    if (selectedPrompt) {
      onUpdatePrompt({
        ...selectedPrompt,
        template: selectedPrompt.template + text
      });
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    // Removed e.preventDefault() to avoid blocking standard click behavior which might be needed in some contexts
    e.stopPropagation(); // CRITICAL: Stop the click from reaching the parent div (selection)
    onDeletePrompt(id);
  };

  return (
    <div className="flex-1 flex bg-gray-950 h-full overflow-hidden">
      {/* Sidebar List */}
      <div className="w-72 border-r border-gray-800 bg-gray-900/50 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <h2 className="font-bold text-gray-200 flex items-center">
            <Terminal className="w-5 h-5 mr-2 text-green-500" />
            指令工程
          </h2>
          <button onClick={handleCreate} className="p-1 hover:bg-gray-700 rounded text-green-400" title="新建指令">
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-2 border-b border-gray-800 overflow-x-auto whitespace-nowrap custom-scrollbar flex space-x-2">
          <button 
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${filter === 'all' ? 'bg-gray-700 text-white border-gray-600' : 'text-gray-500 border-transparent hover:bg-gray-800'}`}
          >
            全部
          </button>
          {CATEGORIES.map(cat => (
             <button 
             key={cat.value}
             onClick={() => setFilter(cat.value)}
             className={`px-3 py-1 text-xs rounded-full border transition-colors ${filter === cat.value ? 'bg-gray-700 text-white border-gray-600' : 'text-gray-500 border-transparent hover:bg-gray-800'}`}
           >
             {cat.label.split(' ')[0]}
           </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredPrompts.map(prompt => (
            <div
              key={prompt.id}
              onClick={() => setSelectedId(prompt.id)}
              className={`w-full text-left px-3 py-3 rounded text-sm transition-colors group relative cursor-pointer flex items-center justify-between ${
                selectedId === prompt.id 
                  ? 'bg-gray-800 text-white border-l-2 border-green-500' 
                  : 'text-gray-400 hover:bg-gray-800 border-l-2 border-transparent'
              }`}
            >
              <div className="flex-1 min-w-0 mr-2">
                <div className="font-medium flex items-center">
                  <span className="truncate">{prompt.name}</span>
                  {prompt.isBuiltIn && <span className="text-[10px] bg-gray-700 px-1 rounded text-gray-400 ml-2 shrink-0">内置</span>}
                </div>
                <div className="text-xs opacity-50 line-clamp-1 mt-0.5">{prompt.description}</div>
              </div>

              {!prompt.isBuiltIn && (
                 <button
                   type="button"
                   onClick={(e) => handleDeleteClick(e, prompt.id)}
                   className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors z-10 shrink-0"
                   title="删除"
                 >
                   <Trash2 className="w-4 h-4" />
                 </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col bg-gray-950 overflow-y-auto">
        {selectedPrompt ? (
          <div className="max-w-4xl mx-auto w-full p-8 space-y-6">
            
            {/* Header / Meta */}
            <div className="flex justify-between items-start border-b border-gray-800 pb-6">
              <div className="space-y-4 flex-1 mr-8">
                <input
                  value={selectedPrompt.name}
                  onChange={(e) => onUpdatePrompt({ ...selectedPrompt, name: e.target.value })}
                  className="bg-transparent text-2xl font-bold text-white border-none focus:ring-0 w-full outline-none placeholder-gray-600"
                  placeholder="指令名称"
                  readOnly={selectedPrompt.isBuiltIn}
                />
                <input
                  value={selectedPrompt.description || ''}
                  onChange={(e) => onUpdatePrompt({ ...selectedPrompt, description: e.target.value })}
                  className="bg-transparent text-sm text-gray-400 border-none focus:ring-0 w-full outline-none placeholder-gray-600"
                  placeholder="简短描述该指令的用途..."
                />
                <div className="flex items-center space-x-4">
                  <select
                    value={selectedPrompt.category}
                    onChange={(e) => onUpdatePrompt({ ...selectedPrompt, category: e.target.value as PromptCategory })}
                    className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-green-400 outline-none focus:border-green-500"
                    disabled={selectedPrompt.isBuiltIn}
                  >
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleManualSave}
                  className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg ${
                    showSaved ? 'bg-green-600 text-white shadow-green-500/20' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
                  }`}
                  title="自动保存生效中，点击可确认"
                >
                  {showSaved ? <Check className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {showSaved ? '已保存' : '保存'}
                </button>

                {!selectedPrompt.isBuiltIn && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteClick(e, selectedPrompt.id)}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/10 rounded-lg transition-colors border border-transparent hover:border-red-900/30"
                    title="删除指令"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Template Editor */}
            <div className="space-y-3 flex-1 flex flex-col min-h-[400px]">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-gray-500 uppercase flex items-center">
                   <Command className="w-3 h-3 mr-1" /> 提示词模板 (Prompt Template)
                </label>
                <div className="flex space-x-2">
                   <button onClick={() => handleCopyVariable('{{context}}')} className="text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-indigo-300 border border-indigo-500/20 transition-colors">
                     + 上下文 {'{{context}}'}
                   </button>
                   <button onClick={() => handleCopyVariable('{{input}}')} className="text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-yellow-300 border border-yellow-500/20 transition-colors">
                     + 用户输入 {'{{input}}'}
                   </button>
                </div>
              </div>
              
              <div className="relative flex-1">
                <textarea
                  value={selectedPrompt.template}
                  onChange={(e) => onUpdatePrompt({ ...selectedPrompt, template: e.target.value })}
                  className="w-full h-full min-h-[400px] bg-gray-900 border border-gray-700 rounded-lg p-5 text-gray-300 font-mono text-sm leading-relaxed focus:border-green-500 outline-none resize-none custom-scrollbar shadow-inner"
                  placeholder="在此输入你的提示词。系统会自动将选中的小说上下文注入到 prompt 之前。"
                  spellCheck={false}
                />
              </div>

              <div className="bg-gray-900/50 p-4 rounded border border-gray-800 text-xs text-gray-500 space-y-1">
                <p className="font-semibold text-gray-400">提示词编写指南：</p>
                <p>1. 系统会自动在你的提示词之前附带“系统指令”、“世界观设定”和“当前章节上下文”。</p>
                <p>2. 此处编写的内容主要是具体的 **任务指令**。</p>
                <p>3. 示例： "请重写上述段落，重点突出环境的压抑感，使用更多关于声音的描写。"</p>
              </div>
            </div>

          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600 flex-col">
            <Terminal className="w-12 h-12 mb-4 opacity-20" />
            <p>选择一个指令进行编辑，或新建指令</p>
          </div>
        )}
      </div>
    </div>
  );
};

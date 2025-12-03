
import React, { useState } from 'react';
import { X, Cpu, Palette, Save, Monitor, ShieldCheck, Server } from 'lucide-react';
import { AppSettings, AIProvider } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
}

const RECOMMENDED_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash-thinking-exp-01-21",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "gpt-4o",
  "gpt-4-turbo",
  "deepseek-chat",
  "deepseek-coder",
  "claude-3-5-sonnet-20240620",
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [activeTab, setActiveTab] = useState<'ai' | 'appearance'>('ai');
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const updateAI = (updates: Partial<typeof settings.ai>) => {
    setLocalSettings(prev => ({
      ...prev,
      ai: { ...prev.ai, ...updates }
    }));
  };

  const updateAppearance = (updates: Partial<typeof settings.appearance>) => {
    setLocalSettings(prev => ({
      ...prev,
      appearance: { ...prev.appearance, ...updates }
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white flex items-center">
            全局设置
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs & Content Container */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-48 bg-gray-950/50 border-r border-gray-800 p-4 space-y-2">
            <button
              onClick={() => setActiveTab('ai')}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'ai' 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              <Cpu className="w-4 h-4 mr-3" />
              模型配置
            </button>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'appearance' 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              <Palette className="w-4 h-4 mr-3" />
              界面外观
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-gray-900">
            
            {/* AI Settings */}
            {activeTab === 'ai' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                    <Server className="w-4 h-4 mr-2" /> 模型提供商
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {(['gemini', 'openai', 'ollama'] as AIProvider[]).map(provider => (
                      <button
                        key={provider}
                        onClick={() => updateAI({ provider })}
                        className={`px-4 py-3 rounded-lg border text-sm font-medium capitalize transition-all ${
                          localSettings.ai.provider === provider
                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'
                        }`}
                      >
                        {provider}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1.5">API Key</label>
                    <div className="relative">
                      <input
                        type="password"
                        value={localSettings.ai.apiKey}
                        onChange={(e) => updateAI({ apiKey: e.target.value })}
                        placeholder={localSettings.ai.provider === 'gemini' ? "使用默认环境变量 (无需输入)" : "sk-..."}
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg py-2.5 px-4 text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      />
                      <ShieldCheck className="absolute right-3 top-2.5 w-5 h-5 text-gray-600" />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {localSettings.ai.provider === 'gemini' 
                        ? '默认使用系统环境变量中的 Key。如需覆盖请在此输入。' 
                        : 'Key 仅存储在本地浏览器中，不会上传到服务器。'}
                    </p>
                  </div>

                  {localSettings.ai.provider === 'ollama' && (
                    <div>
                      <label className="block text-sm text-gray-300 mb-1.5">本地 URL (Ollama)</label>
                      <input
                        type="text"
                        value={localSettings.ai.baseUrl || 'http://localhost:11434'}
                        onChange={(e) => updateAI({ baseUrl: e.target.value })}
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg py-2.5 px-4 text-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm text-gray-300 mb-1.5">模型名称 (Model Name)</label>
                    <div className="relative">
                      <input
                        type="text"
                        list="recommended-models"
                        value={localSettings.ai.modelName}
                        onChange={(e) => updateAI({ modelName: e.target.value })}
                        placeholder={localSettings.ai.provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o'}
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg py-2.5 px-4 pr-10 text-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      {localSettings.ai.modelName && (
                        <button 
                          onClick={() => updateAI({ modelName: '' })}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      <datalist id="recommended-models">
                        {RECOMMENDED_MODELS.map(model => (
                          <option key={model} value={model} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 pt-4 border-t border-gray-800">
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm text-gray-300">创意度 (Temperature)</label>
                      <span className="text-sm text-indigo-400 font-mono">{localSettings.ai.temperature}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1.5"
                      step="0.1"
                      value={localSettings.ai.temperature}
                      onChange={(e) => updateAI({ temperature: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">值越高，生成内容越发散、有创意；值越低，内容越严谨。</p>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm text-gray-300">最大 Token 数</label>
                      <span className="text-sm text-indigo-400 font-mono">{localSettings.ai.maxTokens}</span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="8192"
                      step="100"
                      value={localSettings.ai.maxTokens}
                      onChange={(e) => updateAI({ maxTokens: parseInt(e.target.value) })}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Appearance Settings */}
            {activeTab === 'appearance' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                    <Monitor className="w-4 h-4 mr-2" /> 显示设置
                  </h3>
                  
                  <div className="space-y-6">
                     <div className="flex items-center justify-between">
                      <div>
                        <div className="text-gray-200 font-medium">沉浸式写作模式</div>
                        <div className="text-xs text-gray-500">开启后将隐藏侧边栏和 AI 面板，仅保留编辑器。</div>
                      </div>
                      <button
                        onClick={() => updateAppearance({ immersiveMode: !localSettings.appearance.immersiveMode })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          localSettings.appearance.immersiveMode ? 'bg-indigo-600' : 'bg-gray-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            localSettings.appearance.immersiveMode ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-300 mb-3">正文字体大小</label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { id: 'small', label: '小', size: '14px' },
                          { id: 'medium', label: '中', size: '16px' },
                          { id: 'large', label: '大', size: '18px' },
                          { id: 'xlarge', label: '超大', size: '20px' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => updateAppearance({ fontSize: opt.id as any })}
                            className={`py-2 rounded border text-sm transition-all ${
                              localSettings.appearance.fontSize === opt.id
                                ? 'bg-indigo-600 text-white border-indigo-500'
                                : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-750'
                            }`}
                          >
                            <span style={{ fontSize: opt.size }}>A</span> {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-800 flex justify-end space-x-3 bg-gray-950/30 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium flex items-center shadow-lg shadow-indigo-500/20"
          >
            <Save className="w-4 h-4 mr-2" />
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
};

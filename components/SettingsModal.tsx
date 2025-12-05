
import React, { useState } from 'react';
import { X, Cpu, Palette, Save, Monitor, ShieldCheck, Server, Plus, Trash2, Check, Zap, Eye, EyeOff } from 'lucide-react';
import { AppSettings, AIProvider, ModelConfig } from '../types';
import { testModelConfig } from '../services/geminiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
}

const RECOMMENDED_MODELS = [
  "gemini-2.5-flash",
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [activeTab, setActiveTab] = useState<'models' | 'appearance'>('models');
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(
    localSettings.defaultModelId || localSettings.models?.[0]?.id || null
  );
  const [testingModel, setTestingModel] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    // Ensure at least one model exists
    if (!localSettings.models || localSettings.models.length === 0) {
      alert('至少需要配置一个模型');
      return;
    }
    onSave(localSettings);
    // onClose(); // Keep modal open

    // Optional: Show feedback
    const btn = document.getElementById('save-settings-btn');
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = '<svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> 已保存';
      btn.classList.add('bg-green-600', 'hover:bg-green-500');
      btn.classList.remove('bg-indigo-600', 'hover:bg-indigo-500');

      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.classList.remove('bg-green-600', 'hover:bg-green-500');
        btn.classList.add('bg-indigo-600', 'hover:bg-indigo-500');
      }, 2000);
    }
  };

  const selectedModel = localSettings.models?.find(m => m.id === selectedModelId);

  const handleAddModel = () => {
    const newModel: ModelConfig = {
      id: Date.now().toString(),
      name: '新模型',
      provider: 'gemini',
      apiKey: '',
      modelName: 'gemini-2.5-flash',
      temperature: 0.8,
      maxTokens: 2048,
      contextWindow: 2000,
    };
    setLocalSettings(prev => ({
      ...prev,
      models: [...(prev.models || []), newModel],
      defaultModelId: prev.defaultModelId || newModel.id,
    }));
    setSelectedModelId(newModel.id);
    setTestResult(null);
  };

  const handleDeleteModel = (id: string) => {
    if (localSettings.models && localSettings.models.length <= 1) {
      alert('至少需要保留一个模型');
      return;
    }
    setLocalSettings(prev => {
      const newModels = prev.models?.filter(m => m.id !== id) || [];
      return {
        ...prev,
        models: newModels,
        defaultModelId: prev.defaultModelId === id ? newModels[0]?.id : prev.defaultModelId,
      };
    });
    if (selectedModelId === id) {
      setSelectedModelId(localSettings.models?.find(m => m.id !== id)?.id || null);
      setTestResult(null);
    }
  };

  const handleUpdateModel = (updates: Partial<ModelConfig>) => {
    if (!selectedModelId) return;
    setLocalSettings(prev => ({
      ...prev,
      models: prev.models?.map(m => m.id === selectedModelId ? { ...m, ...updates } : m),
    }));
  };

  const handleSetDefault = (id: string) => {
    setLocalSettings(prev => ({
      ...prev,
      defaultModelId: id,
    }));
  };

  const handleTestModel = async () => {
    if (!selectedModel) return;
    setTestingModel(true);
    setTestResult(null);

    const result = await testModelConfig(selectedModel);
    setTestResult(result);
    setTestingModel(false);
  };

  const updateAppearance = (updates: Partial<typeof settings.appearance>) => {
    setLocalSettings(prev => ({
      ...prev,
      appearance: { ...prev.appearance, ...updates }
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">

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
              onClick={() => setActiveTab('models')}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'models'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
            >
              <Cpu className="w-4 h-4 mr-3" />
              模型管理
            </button>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'appearance'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
            >
              <Palette className="w-4 h-4 mr-3" />
              界面外观
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex overflow-hidden">

            {/* Model Management */}
            {activeTab === 'models' && (
              <>
                {/* Model List */}
                <div className="w-64 border-r border-gray-800 bg-gray-900/30 flex flex-col">
                  <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-gray-300">模型列表</h3>
                    <button
                      onClick={handleAddModel}
                      className="p-1 hover:bg-gray-700 rounded text-indigo-400"
                      title="添加模型"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {localSettings.models?.map(model => (
                      <div
                        key={model.id}
                        className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${selectedModelId === model.id
                          ? 'bg-indigo-600/20 border border-indigo-500/50'
                          : 'hover:bg-gray-800 border border-transparent'
                          }`}
                        onClick={() => {
                          setSelectedModelId(model.id);
                          setTestResult(null);
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-200 truncate">{model.name}</div>
                          <div className="text-xs text-gray-500 truncate">{model.modelName}</div>
                        </div>
                        {localSettings.defaultModelId === model.id && (
                          <Check className="w-4 h-4 text-green-400 ml-2 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Model Editor */}
                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-gray-900">
                  {selectedModel ? (
                    <div className="space-y-6 max-w-2xl">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-white">编辑模型配置</h3>
                        <div className="flex gap-2">
                          <button
                            onClick={handleTestModel}
                            disabled={testingModel}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm flex items-center disabled:opacity-50"
                          >
                            <Zap className="w-4 h-4 mr-1" />
                            {testingModel ? '测试中...' : '测试连接'}
                          </button>
                          {localSettings.defaultModelId !== selectedModel.id && (
                            <button
                              onClick={() => handleSetDefault(selectedModel.id)}
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-sm"
                            >
                              设为默认
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteModel(selectedModel.id)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-sm"
                          >
                            删除
                          </button>
                        </div>
                      </div>

                      {/* Test Result */}
                      {testResult && (
                        <div className={`p-4 rounded-lg border ${testResult.success
                          ? 'bg-green-900/20 border-green-500/50 text-green-300'
                          : 'bg-red-900/20 border-red-500/50 text-red-300'
                          }`}>
                          <pre className="text-sm whitespace-pre-wrap font-mono">{testResult.message}</pre>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm text-gray-300 mb-1.5">模型名称</label>
                        <input
                          type="text"
                          value={selectedModel.name}
                          onChange={(e) => handleUpdateModel({ name: e.target.value })}
                          className="w-full bg-gray-950 border border-gray-700 rounded-lg py-2.5 px-4 text-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                          <Server className="w-4 h-4 mr-2" /> 提供商
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          {(['gemini', 'openai', 'ollama', 'custom'] as AIProvider[]).map(provider => (
                            <button
                              key={provider}
                              onClick={() => handleUpdateModel({ provider })}
                              className={`px-4 py-3 rounded-lg border text-sm font-medium capitalize transition-all ${selectedModel.provider === provider
                                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                                : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'
                                }`}
                            >
                              {provider === 'custom' ? 'Custom/DeepSeek' : provider}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          💡 DeepSeek 请选择 "Custom/DeepSeek" 并配置 URL 为 https://api.deepseek.com
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-300 mb-1.5">API Key</label>
                        <div className="relative">
                          <input
                            type={showApiKey ? "text" : "password"}
                            value={selectedModel.apiKey}
                            onChange={(e) => handleUpdateModel({ apiKey: e.target.value })}
                            placeholder={selectedModel.provider === 'gemini' ? "使用默认环境变量 (无需输入)" : "sk-..."}
                            className="w-full bg-gray-950 border border-gray-700 rounded-lg py-2.5 px-4 pr-10 text-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-300 focus:outline-none"
                            onMouseDown={() => setShowApiKey(true)}
                            onMouseUp={() => setShowApiKey(false)}
                            onMouseLeave={() => setShowApiKey(false)}
                            onTouchStart={() => setShowApiKey(true)}
                            onTouchEnd={() => setShowApiKey(false)}
                            title="长按显示 Key"
                          >
                            {showApiKey ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {selectedModel.provider === 'gemini'
                            ? '默认使用系统环境变量中的 Key。如需覆盖请在此输入。'
                            : 'Key 仅存储在本地浏览器中，不会上传到服务器。'}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-300 mb-1.5">自定义 URL / Endpoint</label>
                        <input
                          type="text"
                          value={selectedModel.baseUrl || ''}
                          onChange={(e) => handleUpdateModel({ baseUrl: e.target.value })}
                          placeholder={selectedModel.provider === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com'}
                          className="w-full bg-gray-950 border border-gray-700 rounded-lg py-2.5 px-4 text-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {selectedModel.provider === 'custom'
                            ? 'DeepSeek: https://api.deepseek.com | 其他自定义端点请填写完整 URL'
                            : selectedModel.provider === 'ollama'
                              ? 'Ollama 默认: http://localhost:11434'
                              : '可选。用于自定义 API 端点。'}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-300 mb-1.5">模型 ID (Model Name)</label>
                        <div className="relative">
                          <input
                            type="text"
                            list="recommended-models"
                            value={selectedModel.modelName}
                            onChange={(e) => handleUpdateModel({ modelName: e.target.value })}
                            placeholder="gemini-2.5-flash"
                            className="w-full bg-gray-950 border border-gray-700 rounded-lg py-2.5 px-4 text-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                          <datalist id="recommended-models">
                            {RECOMMENDED_MODELS.map(model => (
                              <option key={model} value={model} />
                            ))}
                          </datalist>
                        </div>
                      </div>

                      <div className="space-y-6 pt-4 border-t border-gray-800">
                        <div>
                          <div className="flex justify-between mb-2">
                            <label className="text-sm text-gray-300">创意度 (Temperature)</label>
                            <span className="text-sm text-indigo-400 font-mono">{selectedModel.temperature}</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1.5"
                            step="0.1"
                            value={selectedModel.temperature}
                            onChange={(e) => handleUpdateModel({ temperature: parseFloat(e.target.value) })}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between mb-2">
                            <label className="text-sm text-gray-300">最大 Token 数</label>
                            <span className="text-sm text-indigo-400 font-mono">{selectedModel.maxTokens}</span>
                          </div>
                          <input
                            type="range"
                            min="100"
                            max="8192"
                            step="100"
                            value={selectedModel.maxTokens}
                            onChange={(e) => handleUpdateModel({ maxTokens: parseInt(e.target.value) })}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <Cpu className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p>请选择一个模型进行编辑</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Appearance Settings */}
            {activeTab === 'appearance' && (
              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-gray-900">
                <div className="space-y-8 max-w-2xl">
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
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localSettings.appearance.immersiveMode ? 'bg-indigo-600' : 'bg-gray-700'
                            }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.appearance.immersiveMode ? 'translate-x-6' : 'translate-x-1'
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
                              className={`py-2 rounded border text-sm transition-all ${localSettings.appearance.fontSize === opt.id
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
            id="save-settings-btn"
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

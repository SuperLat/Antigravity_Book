
import React, { useState } from 'react';
import { Entity, EntityType } from '../types';
import { Plus, Trash2, Save, Lightbulb, Wand2, Loader2 } from 'lucide-react';

interface WikiViewProps {
  entities: Entity[];
  onAddEntity: (entity: Entity) => void;
  onUpdateEntity: (entity: Entity) => void;
  onDeleteEntity: (id: string) => void;
  onGenerateWorldview?: (idea: Entity) => Promise<void>;
  isGenerating?: boolean;
}

export const WikiView: React.FC<WikiViewProps> = ({ 
  entities, 
  onAddEntity, 
  onUpdateEntity, 
  onDeleteEntity,
  onGenerateWorldview,
  isGenerating = false
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(entities[0]?.id || null);

  const selectedEntity = entities.find(e => e.id === selectedId);

  const handleCreate = () => {
    const newEntity: Entity = {
      id: Date.now().toString(),
      type: EntityType.CHARACTER,
      name: '新条目',
      description: '简短描述...',
      tags: [],
      content: '详细信息...'
    };
    onAddEntity(newEntity);
    setSelectedId(newEntity.id);
  };

  const handleSave = (updated: Entity) => {
    onUpdateEntity(updated);
  };

  const getIcon = (type: EntityType) => {
    switch (type) {
      case EntityType.CHARACTER: return null; 
      case EntityType.WORLDVIEW: return null;
      case EntityType.PLOT: return null;
      case EntityType.IDEA: return <Lightbulb className="w-3 h-3 ml-1 inline text-yellow-500" />;
      default: return null;
    }
  };

  const getTypeText = (type: EntityType) => {
    switch (type) {
      case EntityType.CHARACTER: return '角色';
      case EntityType.WORLDVIEW: return '世界观';
      case EntityType.PLOT: return '剧情';
      case EntityType.IDEA: return '脑洞/灵感';
      default: return '未知';
    }
  };

  return (
    <div className="flex-1 flex bg-gray-950 h-full overflow-hidden">
      {/* Wiki List */}
      <div className="w-64 border-r border-gray-800 bg-gray-900/50 flex flex-col">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <h2 className="font-bold text-gray-200">知识库</h2>
          <button onClick={handleCreate} className="p-1 hover:bg-gray-700 rounded text-indigo-400">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {entities.map(entity => (
            <button
              key={entity.id}
              onClick={() => setSelectedId(entity.id)}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                selectedId === entity.id 
                  ? 'bg-indigo-900/30 text-indigo-200 border border-indigo-500/30' 
                  : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <div className="font-medium flex items-center">
                {entity.name} 
                {entity.type === EntityType.IDEA && <Lightbulb className="w-3 h-3 ml-2 text-yellow-500/70" />}
              </div>
              <div className="text-xs opacity-60 uppercase tracking-wider">
                {getTypeText(entity.type)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Wiki Editor */}
      <div className="flex-1 flex flex-col p-8 overflow-y-auto bg-gray-950">
        {selectedEntity ? (
          <div className="max-w-2xl mx-auto w-full space-y-6">
            <div className="flex justify-between items-start">
              <div className="space-y-4 w-full">
                <input
                  value={selectedEntity.name}
                  onChange={(e) => handleSave({ ...selectedEntity, name: e.target.value })}
                  className="bg-transparent text-3xl font-bold text-white border-none focus:ring-0 w-full outline-none placeholder-gray-600"
                  placeholder="名称"
                />
                <div className="flex gap-4">
                  <select
                    value={selectedEntity.type}
                    onChange={(e) => handleSave({ ...selectedEntity, type: e.target.value as EntityType })}
                    className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-indigo-300 outline-none focus:border-indigo-500"
                  >
                    <option value={EntityType.CHARACTER}>角色 (Character)</option>
                    <option value={EntityType.WORLDVIEW}>世界观 (Worldview)</option>
                    <option value={EntityType.PLOT}>剧情点 (Plot)</option>
                    <option value={EntityType.IDEA}>脑洞 (Idea Box)</option>
                  </select>
                </div>
              </div>
              <button
                onClick={() => onDeleteEntity(selectedEntity.id)}
                className="text-gray-600 hover:text-red-400 transition-colors"
                title="删除条目"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase">简述 (用于上下文注入)</label>
              <input
                value={selectedEntity.description}
                onChange={(e) => handleSave({ ...selectedEntity, description: e.target.value })}
                className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-gray-300 focus:border-indigo-500 outline-none transition-colors"
              />
            </div>

            <div className="space-y-2 h-full flex flex-col">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-gray-500 uppercase">详细内容</label>
                
                {/* AI Generator Button for IDEA type */}
                {selectedEntity.type === EntityType.IDEA && onGenerateWorldview && (
                  <button
                    onClick={() => onGenerateWorldview(selectedEntity)}
                    disabled={isGenerating || !selectedEntity.content}
                    className="flex items-center text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1 rounded transition-colors shadow-lg shadow-indigo-500/20"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Wand2 className="w-3 h-3 mr-1" />
                    )}
                    {isGenerating ? '架构生成中...' : '生成世界观'}
                  </button>
                )}
              </div>
              
              <textarea
                value={selectedEntity.content}
                onChange={(e) => handleSave({ ...selectedEntity, content: e.target.value })}
                className={`w-full ${selectedEntity.type === EntityType.IDEA ? 'h-48' : 'h-96'} bg-gray-900 border border-gray-800 rounded p-4 text-gray-300 leading-relaxed focus:border-indigo-500 outline-none resize-none custom-scrollbar`}
                placeholder={selectedEntity.type === EntityType.IDEA 
                  ? "在此记录你的灵感碎片（例如：赛博朋克背景下的修仙故事，核心是义体飞升...）" 
                  : "在此编写详细的背景、外貌、历史或规则..."}
              />
              
              {selectedEntity.type === EntityType.IDEA && (
                <div className="bg-gray-900/50 p-4 rounded border border-gray-800 text-sm text-gray-500">
                  <p className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                    <strong>提示：</strong> 在上方输入灵感，点击“生成世界观”，AI 将自动为你构建完整的世界观设定并保存为新条目。
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600">
            选择或创建一个条目进行编辑
          </div>
        )}
      </div>
    </div>
  );
};

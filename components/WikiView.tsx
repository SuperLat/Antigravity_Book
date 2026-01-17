import React, { useState, useEffect } from 'react';
import { Entity, EntityType } from '../types';
import { Plus, Trash2, Lightbulb, Wand2, Loader2, User, Globe, BookMarked, Sparkles } from 'lucide-react';
import { useDialog } from '../hooks/useDialog';
import { CustomDialog } from './CustomDialog';

interface WikiViewProps {
  entities: Entity[];
  onAddEntity: (entity: Entity) => void;
  onUpdateEntity: (entity: Entity) => void;
  onDeleteEntity: (id: string) => void;
  onGenerateWorldview?: (idea: Entity) => Promise<void>;
  isGenerating?: boolean;
  selectedType: EntityType;
}

const ENTITY_TYPE_CONFIG: Record<EntityType, { label: string; icon: any; color: string }> = {
  [EntityType.CHARACTER]: { label: '角色', icon: User, color: 'text-blue-400' },
  [EntityType.WORLDVIEW]: { label: '世界观', icon: Globe, color: 'text-purple-400' },
  [EntityType.PLOT]: { label: '剧情', icon: BookMarked, color: 'text-green-400' },
  [EntityType.IDEA]: { label: '脑洞', icon: Lightbulb, color: 'text-yellow-400' },
};

export const WikiView: React.FC<WikiViewProps> = ({
  entities,
  onAddEntity,
  onUpdateEntity,
  onDeleteEntity,
  onGenerateWorldview,
  isGenerating = false,
  selectedType
}) => {
  // 自定义对话框系统
  const { dialogConfig, closeDialog, showConfirm } = useDialog();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filter entities by selected type
  const filteredEntities = entities.filter(e => e.type === selectedType);
  const selectedEntity = entities.find(e => e.id === selectedId);

  // Auto-select first entity when type changes
  useEffect(() => {
    const firstOfType = entities.find(e => e.type === selectedType);
    if (firstOfType) {
      setSelectedId(firstOfType.id);
    } else {
      setSelectedId(null);
    }
  }, [selectedType, entities]);

  const handleCreate = () => {
    const typeConfig = ENTITY_TYPE_CONFIG[selectedType];
    const newEntity: Entity = {
      id: Date.now().toString(),
      type: selectedType,
      name: `新${typeConfig?.label || '条目'}`,
      description: '',
      tags: [],
      content: ''
    };
    onAddEntity(newEntity);
    setSelectedId(newEntity.id);
  };

  const handleSave = (updated: Entity) => {
    onUpdateEntity(updated);
  };

  const handleDelete = async () => {
    if (selectedEntity) {
      const confirmed = await showConfirm(`确定删除"${selectedEntity.name}"吗？`, '删除设定');
      if (confirmed) {
        onDeleteEntity(selectedEntity.id);
        setSelectedId(null);
      }
    }
  };

  const typeConfig = ENTITY_TYPE_CONFIG[selectedType];
  const TypeIcon = typeConfig?.icon || Sparkles;

  return (
    <div className="flex-1 flex bg-gray-950 h-full overflow-hidden">
      {/* Left: Entity List */}
      <div className="w-72 border-r border-gray-800 bg-gray-900/30 flex flex-col">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <h2 className="font-bold text-gray-200 flex items-center gap-2">
            <TypeIcon className={`w-4 h-4 ${typeConfig?.color}`} />
            {typeConfig?.label}列表
          </h2>
          <button
            onClick={handleCreate}
            className="p-1.5 hover:bg-gray-700 rounded text-indigo-400 transition-colors"
            title="添加新条目"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {filteredEntities.length === 0 ? (
            <div className="text-center text-gray-600 py-8 text-sm">
              暂无{typeConfig?.label}
              <br />
              <button
                onClick={handleCreate}
                className="mt-2 text-indigo-400 hover:underline"
              >
                点击添加
              </button>
            </div>
          ) : (
            filteredEntities.map(entity => (
              <button
                key={entity.id}
                onClick={() => setSelectedId(entity.id)}
                className={`w-full text-left px-3 py-3 rounded-lg text-sm transition-all ${selectedId === entity.id
                  ? 'bg-indigo-900/30 text-indigo-200 border border-indigo-500/30'
                  : 'text-gray-400 hover:bg-gray-800 border border-transparent'
                  }`}
              >
                <div className="font-medium truncate">{entity.name}</div>
                {entity.description && (
                  <div className="text-xs opacity-60 truncate mt-0.5">{entity.description}</div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: Entity Detail Editor */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-950">
        {selectedEntity ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-800 bg-gray-900/30">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 space-y-3">
                  <input
                    value={selectedEntity.name}
                    onChange={(e) => handleSave({ ...selectedEntity, name: e.target.value })}
                    className="bg-transparent text-2xl font-bold text-white border-none focus:ring-0 w-full outline-none placeholder-gray-600"
                    placeholder="名称"
                  />
                  <input
                    value={selectedEntity.description}
                    onChange={(e) => handleSave({ ...selectedEntity, description: e.target.value })}
                    className="w-full bg-gray-800/50 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-indigo-500 outline-none transition-colors"
                    placeholder="简短描述（用于AI上下文）"
                  />
                </div>
                <button
                  onClick={handleDelete}
                  className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                  title="删除条目"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Editor */}
            <div className="flex-1 p-6 overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <label className="text-xs font-semibold text-gray-500 uppercase">详细内容</label>

                {/* AI Generator Button for IDEA type */}
                {selectedEntity.type === EntityType.IDEA && onGenerateWorldview && (
                  <button
                    onClick={() => onGenerateWorldview(selectedEntity)}
                    disabled={isGenerating || !selectedEntity.content}
                    className="flex items-center text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded transition-colors shadow-lg shadow-indigo-500/20"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                    ) : (
                      <Wand2 className="w-3 h-3 mr-1.5" />
                    )}
                    {isGenerating ? '生成中...' : '生成世界观'}
                  </button>
                )}
              </div>

              <textarea
                value={selectedEntity.content}
                onChange={(e) => handleSave({ ...selectedEntity, content: e.target.value })}
                className="flex-1 w-full bg-gray-900 border border-gray-800 rounded-lg p-4 text-gray-300 leading-relaxed focus:border-indigo-500 outline-none resize-none custom-scrollbar"
                placeholder={selectedEntity.type === EntityType.IDEA
                  ? "在此记录你的灵感碎片..."
                  : "在此编写详细的背景、外貌、历史或规则..."}
              />

              {selectedEntity.type === EntityType.IDEA && (
                <div className="mt-4 bg-gray-900/50 p-4 rounded-lg border border-gray-800 text-sm text-gray-500">
                  <p className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                    <span><strong>提示：</strong>输入灵感后点击"生成世界观"，AI 将自动构建完整设定。</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <TypeIcon className={`w-8 h-8 ${typeConfig?.color}`} />
              </div>
              <p>选择或创建一个{typeConfig?.label}条目</p>
              <button
                onClick={handleCreate}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-sm"
              >
                <Plus className="w-4 h-4 inline mr-1" />
                添加{typeConfig?.label}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 全局自定义对话框 */}
      <CustomDialog config={dialogConfig} onClose={closeDialog} />
    </div>
  );
};

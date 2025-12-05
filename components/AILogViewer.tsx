import React, { useState, useEffect } from 'react';
import { aiLogsAPI } from '../services/api';
import { X, Loader2, Clock, Filter, ChevronLeft, ChevronRight, Eye, Trash2 } from 'lucide-react';

interface AILogViewerProps {
    isOpen: boolean;
    onClose: () => void;
}

interface AILog {
    _id: string;
    actionType: string;
    category?: string;
    prompt: string;
    response: string;
    modelName?: string;
    timestamp: string;
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
    summary: '章节摘要',
    worldview: '世界观生成',
    generate: '内容生成'
};

const ACTION_LABELS: Record<string, string> = {
    chat: '对话',
    summary: '摘要',
    worldview: '世界观',
    generate: '生成'
};

export const AILogViewer: React.FC<AILogViewerProps> = ({ isOpen, onClose }) => {
    const [logs, setLogs] = useState<AILog[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [filterCategory, setFilterCategory] = useState('');
    const [selectedLog, setSelectedLog] = useState<AILog | null>(null);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await aiLogsAPI.getAll(page, 10, filterCategory ? { category: filterCategory } : {});
            setLogs(data.logs);
            setTotalPages(data.totalPages);
            setTotalCount(data.total || data.logs.length);
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchLogs();
        }
    }, [isOpen, page, filterCategory]);

    // Truncate text for preview
    const truncateText = (text: string, maxLength: number = 100) => {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    };

    // Format relative time
    const formatRelativeTime = (timestamp: string) => {
        const now = new Date();
        const date = new Date(timestamp);
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return '刚刚';
        if (diffMins < 60) return `${diffMins} 分钟前`;
        if (diffHours < 24) return `${diffHours} 小时前`;
        if (diffDays < 7) return `${diffDays} 天前`;
        return date.toLocaleDateString();
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl">
                    {/* Header */}
                    <div className="flex justify-between items-center p-5 border-b border-gray-800">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-bold text-white flex items-center">
                                <Clock className="w-5 h-5 mr-2 text-indigo-500" />
                                历史记录
                            </h2>
                            <span className="text-sm text-gray-500">
                                共 {totalCount} 条记录
                            </span>
                        </div>
                        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="p-4 border-b border-gray-800 bg-gray-900/50 flex gap-4 items-center">
                        <div className="relative flex-1 max-w-xs">
                            <Filter className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <select
                                value={filterCategory}
                                onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
                                className="w-full bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-indigo-500 appearance-none"
                            >
                                <option value="">所有分类</option>
                                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <span className="text-xs text-gray-600">
                            记录保留 7 天
                        </span>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {loading ? (
                            <div className="flex justify-center py-10">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="text-center text-gray-500 py-10">
                                暂无记录
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead className="bg-gray-800/50 sticky top-0">
                                    <tr className="text-left text-xs text-gray-500 uppercase">
                                        <th className="px-4 py-3 font-medium">时间</th>
                                        <th className="px-4 py-3 font-medium w-40">分类</th>
                                        <th className="px-4 py-3 font-medium">模型</th>
                                        <th className="px-4 py-3 font-medium">内容预览</th>
                                        <th className="px-4 py-3 font-medium w-20">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {logs.map(log => (
                                        <tr key={log._id} className="hover:bg-gray-800/30 transition-colors">
                                            <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
                                                {formatRelativeTime(log.timestamp)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-900/30 text-indigo-400">
                                                    {CATEGORY_LABELS[log.category || ''] || log.category || ACTION_LABELS[log.actionType] || log.actionType}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                                                {log.modelName || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-300 max-w-md">
                                                <div className="truncate">
                                                    {truncateText(log.response, 80)}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => setSelectedLog(log)}
                                                    className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-indigo-400 transition-colors"
                                                    title="查看详情"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Pagination */}
                    <div className="p-4 border-t border-gray-800 flex justify-between items-center bg-gray-900">
                        <span className="text-sm text-gray-500">
                            第 {page} / {totalPages} 页
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-400 text-sm flex items-center gap-1"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                上一页
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages || totalPages === 0}
                                className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-400 text-sm flex items-center gap-1"
                            >
                                下一页
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detail Modal */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60]">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
                        <div className="flex justify-between items-center p-5 border-b border-gray-800">
                            <div className="flex items-center gap-3">
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-900/30 text-indigo-400">
                                    {CATEGORY_LABELS[selectedLog.category || ''] || selectedLog.category || ACTION_LABELS[selectedLog.actionType] || selectedLog.actionType}
                                </span>
                                <span className="text-sm text-gray-500">
                                    {new Date(selectedLog.timestamp).toLocaleString()}
                                </span>
                                {selectedLog.modelName && (
                                    <span className="text-xs text-gray-600 font-mono bg-gray-800 px-2 py-0.5 rounded">
                                        {selectedLog.modelName}
                                    </span>
                                )}
                            </div>
                            <button onClick={() => setSelectedLog(null)} className="text-gray-500 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                            <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">生成内容</div>
                            <div className="bg-gray-950 rounded-lg p-4 text-sm text-gray-200 whitespace-pre-wrap leading-relaxed border border-gray-800">
                                {selectedLog.response}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

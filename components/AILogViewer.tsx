import React, { useState, useEffect } from 'react';
import { aiLogsAPI } from '../services/api';
import { X, Loader2, Clock, MessageSquare, FileText, Globe, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

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
    worldview: '世界观生成'
};

export const AILogViewer: React.FC<AILogViewerProps> = ({ isOpen, onClose }) => {
    const [logs, setLogs] = useState<AILog[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filterCategory, setFilterCategory] = useState('');

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await aiLogsAPI.getAll(page, 20, filterCategory ? { category: filterCategory } : {});
            setLogs(data.logs);
            setTotalPages(data.totalPages);
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-800">
                    <h2 className="text-2xl font-bold text-white flex items-center">
                        <Clock className="w-6 h-6 mr-3 text-indigo-500" />
                        AI 生成记录
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Filters */}
                <div className="p-4 border-b border-gray-800 bg-gray-900/50 flex gap-4">
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
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center text-gray-500 py-10">
                            暂无记录
                        </div>
                    ) : (
                        logs.map(log => (
                            <div key={log._id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-indigo-500/30 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${log.actionType === 'chat' ? 'bg-blue-900/30 text-blue-400' :
                                            log.actionType === 'summary' ? 'bg-green-900/30 text-green-400' :
                                                'bg-purple-900/30 text-purple-400'
                                            }`}>
                                            {log.actionType === 'chat' ? '对话' : log.actionType === 'summary' ? '摘要' : '世界观'}
                                        </span>
                                        {log.category && (
                                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-300 border border-gray-600">
                                                {CATEGORY_LABELS[log.category] || log.category}
                                            </span>
                                        )}
                                        <span className="text-xs text-gray-500">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </span>
                                    </div>
                                    {log.modelName && (
                                        <span className="text-xs text-gray-600 font-mono bg-gray-900 px-2 py-0.5 rounded">
                                            {log.modelName}
                                        </span>
                                    )}
                                </div>

                                <div>
                                    <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider">生成内容</div>
                                    <div className="bg-gray-900 rounded p-3 text-sm text-gray-200 whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar border border-gray-800">
                                        {log.response}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-gray-800 flex justify-between items-center bg-gray-900">
                    <span className="text-sm text-gray-500">
                        Page {page} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-2 rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-gray-400"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="p-2 rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-gray-400"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

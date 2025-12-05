import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, FileText, AlignLeft, Trash2 } from 'lucide-react';
import { Chapter } from '../types';

interface ChapterLinkModalProps {
    isOpen: boolean;
    onClose: () => void;
    chapters: Chapter[];
    activeChapterId: string;
    selectedLinks: ChapterLink[];
    onSave: (links: ChapterLink[]) => void;
}

export interface ChapterLink {
    chapterId: string;
    type: 'content' | 'summary'; // 正文或概要
}

export const ChapterLinkModal: React.FC<ChapterLinkModalProps> = ({
    isOpen,
    onClose,
    chapters,
    activeChapterId,
    selectedLinks,
    onSave,
}) => {
    const [localLinks, setLocalLinks] = useState<ChapterLink[]>(selectedLinks);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());

    if (!isOpen) return null;

    // 过滤掉当前章节
    const availableChapters = chapters.filter(c => c.id !== activeChapterId);

    // 分页计算
    const totalPages = Math.ceil(availableChapters.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const currentChapters = availableChapters.slice(startIndex, endIndex);

    // 检查章节是否已关联
    const isLinked = (chapterId: string) => {
        return localLinks.some(link => link.chapterId === chapterId);
    };

    // 获取关联类型
    const getLinkType = (chapterId: string): 'content' | 'summary' | null => {
        const link = localLinks.find(l => l.chapterId === chapterId);
        return link ? link.type : null;
    };

    // 切换关联
    const toggleLink = (chapterId: string, type: 'content' | 'summary') => {
        const existingLink = localLinks.find(l => l.chapterId === chapterId);

        if (existingLink) {
            if (existingLink.type === type) {
                // 如果点击的是相同类型，则取消关联
                setLocalLinks(localLinks.filter(l => l.chapterId !== chapterId));
            } else {
                // 如果点击的是不同类型，则切换类型
                setLocalLinks(localLinks.map(l =>
                    l.chapterId === chapterId ? { ...l, type } : l
                ));
            }
        } else {
            // 添加新关联
            setLocalLinks([...localLinks, { chapterId, type }]);
        }
    };

    const handleSave = () => {
        onSave(localLinks);
        onClose();
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    // 一键切换所有已关联章节为正文
    const switchAllToContent = () => {
        const updatedLinks = localLinks.map(link => {
            const chapter = chapters.find(c => c.id === link.chapterId);
            // 只切换有正文内容的章节
            if (chapter?.content) {
                return { ...link, type: 'content' as const };
            }
            return link;
        });
        setLocalLinks(updatedLinks);
    };

    // 一键切换所有已关联章节为概要
    const switchAllToSummary = () => {
        const updatedLinks = localLinks.map(link => {
            const chapter = chapters.find(c => c.id === link.chapterId);
            // 只切换有概要的章节
            if (chapter?.summary) {
                return { ...link, type: 'summary' as const };
            }
            return link;
        });
        setLocalLinks(updatedLinks);
    };

    // 切换复选框选中状态
    const toggleSelection = (chapterId: string) => {
        const newSelection = new Set(selectedForDeletion);
        if (newSelection.has(chapterId)) {
            newSelection.delete(chapterId);
        } else {
            newSelection.add(chapterId);
        }
        setSelectedForDeletion(newSelection);
    };

    // 全选/取消全选
    const toggleSelectAll = () => {
        if (selectedForDeletion.size === localLinks.length) {
            setSelectedForDeletion(new Set());
        } else {
            setSelectedForDeletion(new Set(localLinks.map(link => link.chapterId)));
        }
    };

    // 删除选中的关联
    const deleteSelected = () => {
        if (selectedForDeletion.size === 0) return;
        if (window.confirm(`确定要删除选中的 ${selectedForDeletion.size} 个关联吗？`)) {
            setLocalLinks(localLinks.filter(link => !selectedForDeletion.has(link.chapterId)));
            setSelectedForDeletion(new Set());
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <div>
                        <h2 className="text-xl font-bold text-white">关联章节</h2>
                        <p className="text-sm text-gray-400 mt-1">
                            选择要关联的章节及其内容类型（已选择 {localLinks.length} 个）
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Settings Bar */}
                <div className="p-4 border-b border-gray-800 bg-gray-900/50">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-400">每页显示:</label>
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="bg-gray-800 border border-gray-700 text-gray-300 px-3 py-1.5 rounded text-sm focus:outline-none focus:border-indigo-500"
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                </select>
                            </div>
                            <div className="text-sm text-gray-500">
                                共 {availableChapters.length} 个章节
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                <AlignLeft className="w-3 h-3" /> 正文
                            </span>
                            <span className="text-xs text-gray-500">|</span>
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                <FileText className="w-3 h-3" /> 概要
                            </span>
                        </div>
                    </div>

                    {/* Batch Operations */}
                    {localLinks.length > 0 && (
                        <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">批量操作:</span>
                                <button
                                    onClick={switchAllToContent}
                                    className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded text-xs font-medium transition-colors flex items-center gap-1"
                                >
                                    <AlignLeft className="w-3 h-3" />
                                    全部切换为正文
                                </button>
                                <button
                                    onClick={switchAllToSummary}
                                    className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded text-xs font-medium transition-colors flex items-center gap-1"
                                >
                                    <FileText className="w-3 h-3" />
                                    全部切换为概要
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={toggleSelectAll}
                                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs font-medium transition-colors"
                                >
                                    {selectedForDeletion.size === localLinks.length ? '取消全选' : '全选'}
                                </button>
                                <button
                                    onClick={deleteSelected}
                                    disabled={selectedForDeletion.size === 0}
                                    className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-xs font-medium transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    删除选中 ({selectedForDeletion.size})
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Chapter List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {currentChapters.length === 0 ? (
                        <div className="flex items-center justify-center h-64 text-gray-500">
                            <p>没有可关联的章节</p>
                        </div>
                    ) : (
                        <div className="p-4 space-y-2">
                            {currentChapters.map((chapter, index) => {
                                const linkType = getLinkType(chapter.id);
                                const globalIndex = startIndex + index + 1;

                                // Handle row click - toggle with content as default
                                const handleRowClick = () => {
                                    if (linkType) {
                                        // If already linked, unlink
                                        setLocalLinks(localLinks.filter(l => l.chapterId !== chapter.id));
                                    } else if (chapter.content) {
                                        // Add with content type as default
                                        setLocalLinks([...localLinks, { chapterId: chapter.id, type: 'content' }]);
                                    }
                                };

                                return (
                                    <div
                                        key={chapter.id}
                                        onClick={handleRowClick}
                                        className={`p-4 rounded-lg border transition-all cursor-pointer ${linkType
                                            ? 'bg-indigo-900/20 border-indigo-500/50 ring-1 ring-indigo-500/30'
                                            : 'bg-gray-800/50 border-gray-700 hover:border-gray-500 hover:bg-gray-800'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Checkbox - only show for linked chapters */}
                                            {linkType && (
                                                <div className="pt-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedForDeletion.has(chapter.id)}
                                                        onChange={() => toggleSelection(chapter.id)}
                                                        className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-indigo-500 focus:ring-indigo-500/50 cursor-pointer"
                                                    />
                                                </div>
                                            )}

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h3 className="text-sm font-medium text-gray-200 truncate">
                                                        {chapter.title || '未命名章节'}
                                                    </h3>
                                                </div>
                                                <p className="text-xs text-gray-500 line-clamp-2">
                                                    {chapter.content
                                                        ? chapter.content.substring(0, 100) + (chapter.content.length > 100 ? '...' : '')
                                                        : '暂无内容'}
                                                </p>
                                                {chapter.summary && (
                                                    <div className="mt-2 text-xs text-gray-600 bg-gray-900/50 p-2 rounded">
                                                        <span className="text-gray-500">概要: </span>
                                                        {chapter.summary.substring(0, 80)}
                                                        {chapter.summary.length > 80 ? '...' : ''}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => toggleLink(chapter.id, 'content')}
                                                    disabled={!chapter.content}
                                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${linkType === 'content'
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                        } disabled:opacity-30 disabled:cursor-not-allowed`}
                                                    title={!chapter.content ? '章节内容为空' : '关联正文'}
                                                >
                                                    <AlignLeft className="w-3.5 h-3.5" />
                                                    正文
                                                </button>
                                                <button
                                                    onClick={() => toggleLink(chapter.id, 'summary')}
                                                    disabled={!chapter.summary}
                                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${linkType === 'summary'
                                                        ? 'bg-green-600 text-white'
                                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                        } disabled:opacity-30 disabled:cursor-not-allowed`}
                                                    title={!chapter.summary ? '章节概要为空' : '关联概要'}
                                                >
                                                    <FileText className="w-3.5 h-3.5" />
                                                    概要
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-gray-800 flex items-center justify-between bg-gray-900/50">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="flex items-center gap-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            上一页
                        </button>

                        <div className="flex items-center gap-2">
                            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 7) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 4) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 3) {
                                    pageNum = totalPages - 6 + i;
                                } else {
                                    pageNum = currentPage - 3 + i;
                                }

                                return (
                                    <button
                                        key={i}
                                        onClick={() => handlePageChange(pageNum)}
                                        className={`w-8 h-8 rounded text-sm font-medium transition-colors ${currentPage === pageNum
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            下一页
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}

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
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium"
                    >
                        确定关联 ({localLinks.length})
                    </button>
                </div>
            </div>
        </div>
    );
};

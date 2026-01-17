import React from 'react';
import { AlertCircle, CheckCircle, HelpCircle, X, AlertTriangle } from 'lucide-react';

export type DialogType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

export interface DialogConfig {
    type: DialogType;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
}

interface CustomDialogProps {
    config: DialogConfig | null;
    onClose: () => void;
}

export const CustomDialog: React.FC<CustomDialogProps> = ({ config, onClose }) => {
    if (!config) return null;

    const isConfirm = config.type === 'confirm';

    const handleConfirm = () => {
        config.onConfirm?.();
        onClose();
    };

    const handleCancel = () => {
        config.onCancel?.();
        onClose();
    };

    const getIcon = () => {
        switch (config.type) {
            case 'success':
                return <CheckCircle className="w-12 h-12 text-green-400" />;
            case 'error':
                return <AlertCircle className="w-12 h-12 text-red-400" />;
            case 'warning':
                return <AlertTriangle className="w-12 h-12 text-yellow-400" />;
            case 'confirm':
                return <HelpCircle className="w-12 h-12 text-indigo-400" />;
            default:
                return <AlertCircle className="w-12 h-12 text-blue-400" />;
        }
    };

    const getTitle = () => {
        if (config.title) return config.title;
        switch (config.type) {
            case 'success':
                return '成功';
            case 'error':
                return '错误';
            case 'warning':
                return '警告';
            case 'confirm':
                return '确认操作';
            default:
                return '提示';
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] animate-in fade-in duration-200"
            onClick={isConfirm ? undefined : onClose}
        >
            <div
                className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in zoom-in slide-in-from-bottom-4 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 头部 */}
                <div className="p-6 pb-4 flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                        {getIcon()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-white mb-2">
                            {getTitle()}
                        </h3>
                        <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {config.message}
                        </p>
                    </div>
                    {!isConfirm && (
                        <button
                            onClick={onClose}
                            className="flex-shrink-0 p-1 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-gray-300 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* 底部按钮 */}
                <div className="p-6 pt-4 bg-gray-950/50 flex justify-end gap-3">
                    {isConfirm && (
                        <button
                            onClick={handleCancel}
                            className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors"
                        >
                            {config.cancelText || '取消'}
                        </button>
                    )}
                    <button
                        onClick={handleConfirm}
                        className={`px-5 py-2.5 rounded-lg font-medium transition-colors ${config.type === 'error' || config.type === 'warning'
                                ? 'bg-red-600 hover:bg-red-500 text-white'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                            }`}
                    >
                        {config.confirmText || (isConfirm ? '确认' : '确定')}
                    </button>
                </div>
            </div>
        </div>
    );
};

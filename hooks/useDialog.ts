import { useState, useCallback } from 'react';
import { DialogConfig, DialogType } from '../components/CustomDialog';

export const useDialog = () => {
    const [dialogConfig, setDialogConfig] = useState<DialogConfig | null>(null);

    const closeDialog = useCallback(() => {
        setDialogConfig(null);
    }, []);

    // 显示提示框（info, success, error, warning）
    const showAlert = useCallback((message: string, type: DialogType = 'info', title?: string) => {
        return new Promise<void>((resolve) => {
            setDialogConfig({
                type,
                title,
                message,
                onConfirm: () => resolve(),
            });
        });
    }, []);

    // 显示确认框
    const showConfirm = useCallback((message: string, title?: string) => {
        return new Promise<boolean>((resolve) => {
            setDialogConfig({
                type: 'confirm',
                title,
                message,
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false),
            });
        });
    }, []);

    // 便捷方法
    const showSuccess = useCallback((message: string, title?: string) => {
        return showAlert(message, 'success', title);
    }, [showAlert]);

    const showError = useCallback((message: string, title?: string) => {
        return showAlert(message, 'error', title);
    }, [showAlert]);

    const showWarning = useCallback((message: string, title?: string) => {
        return showAlert(message, 'warning', title);
    }, [showAlert]);

    const showInfo = useCallback((message: string, title?: string) => {
        return showAlert(message, 'info', title);
    }, [showAlert]);

    return {
        dialogConfig,
        closeDialog,
        showAlert,
        showConfirm,
        showSuccess,
        showError,
        showWarning,
        showInfo,
    };
};

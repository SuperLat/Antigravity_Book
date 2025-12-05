import React, { useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { User, Mail, Lock, LogOut, X, Save, Loader2 } from 'lucide-react';

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLogout: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, onLogout }) => {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const [formData, setFormData] = useState({
        username: '',
        email: '',
        currentPassword: '',
        newPassword: ''
    });

    useEffect(() => {
        if (isOpen) {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
                setFormData(prev => ({
                    ...prev,
                    username: parsedUser.username,
                    email: parsedUser.email
                }));
            }
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const updatedUser = await authAPI.updateUser({
                username: formData.username,
                email: formData.email,
                currentPassword: formData.newPassword ? formData.currentPassword : undefined,
                newPassword: formData.newPassword || undefined
            });

            localStorage.setItem('user', JSON.stringify(updatedUser));
            setUser(updatedUser);
            setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '' }));
            setMessage({ type: 'success', text: '个人信息更新成功' });

            // Close after delay
            setTimeout(() => {
                setMessage({ type: '', text: '' });
            }, 2000);
        } catch (error) {
            setMessage({ type: 'error', text: (error as Error).message });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50">
                    <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
                        <User className="w-5 h-5 text-indigo-400" />
                        个人中心
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    {message.text && (
                        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-900/20 text-green-400 border border-green-900/50' : 'bg-red-900/20 text-red-400 border border-red-900/50'
                            }`}>
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">用户名</label>
                            <div className="relative">
                                <User className="w-4 h-4 text-gray-600 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">邮箱</label>
                            <div className="relative">
                                <Mail className="w-4 h-4 text-gray-600 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                            </div>
                        </div>

                        <div className="border-t border-gray-800 pt-4 mt-4">
                            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                                <Lock className="w-4 h-4" /> 修改密码
                            </h3>

                            <div className="space-y-3">
                                <input
                                    type="password"
                                    placeholder="新密码 (留空则不修改)"
                                    value={formData.newPassword}
                                    onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-lg py-2 px-4 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                                />

                                {formData.newPassword && (
                                    <input
                                        type="password"
                                        placeholder="当前密码 (用于验证)"
                                        required
                                        value={formData.currentPassword}
                                        onChange={e => setFormData({ ...formData, currentPassword: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-lg py-2 px-4 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={onLogout}
                                className="flex-1 bg-red-900/20 hover:bg-red-900/30 text-red-400 border border-red-900/50 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <LogOut className="w-4 h-4" /> 退出登录
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> 保存修改</>}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

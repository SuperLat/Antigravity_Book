import React, { useState } from 'react';
import { authAPI } from '../services/api';
import { Lock, Mail, User, Loader2 } from 'lucide-react';

interface AuthPageProps {
    onLogin: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            let response;
            if (isLogin) {
                response = await authAPI.login({
                    identifier: formData.email, // Use email field as identifier (username or email)
                    password: formData.password
                });
            } else {
                response = await authAPI.register(formData);
            }

            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
            onLogin();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-md shadow-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                        NovelCraft
                    </h1>
                    <p className="text-gray-400">
                        {isLogin ? '欢迎回来，请登录您的账号' : '创建新账号开始创作'}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-900/20 border border-red-900/50 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">用户名</label>
                            <div className="relative">
                                <User className="w-5 h-5 text-gray-600 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    required
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:border-indigo-500 transition-colors"
                                    placeholder="您的笔名"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                            {isLogin ? '用户名或邮箱' : '邮箱'}
                        </label>
                        <div className="relative">
                            <Mail className="w-5 h-5 text-gray-600 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type={isLogin ? "text" : "email"}
                                required
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:border-indigo-500 transition-colors"
                                placeholder={isLogin ? "输入用户名或邮箱" : "name@example.com"}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">密码</label>
                        <div className="relative">
                            <Lock className="w-5 h-5 text-gray-600 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="password"
                                required
                                minLength={isLogin ? 1 : 6}
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:border-indigo-500 transition-colors"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? '登录' : '注册')}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-500">
                    {isLogin ? '还没有账号？' : '已有账号？'}
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-indigo-400 hover:text-indigo-300 ml-1 font-medium focus:outline-none"
                    >
                        {isLogin ? '立即注册' : '直接登录'}
                    </button>
                </div>
            </div>
        </div>
    );
};

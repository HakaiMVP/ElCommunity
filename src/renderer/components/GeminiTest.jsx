import React, { useState } from 'react';
import { generateGeminiContent } from '../utils/geminiApi';

const GeminiTest = () => {
    const [prompt, setPrompt] = useState('Diga olá em Português!');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleTest = async () => {
        setLoading(true);
        setError('');
        setResponse('');
        try {
            const res = await generateGeminiContent(prompt);
            setResponse(res);
        } catch (err) {
            setError(err.message || 'Error connecting to Gemini');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 bg-gray-800 rounded-lg shadow-lg border border-gray-700 m-4">
            <h2 className="text-xl font-bold mb-4 text-purple-400">Gemini API Test</h2>
            <div className="flex flex-col gap-4">
                <textarea
                    className="bg-gray-900 text-white p-2 rounded border border-gray-600 focus:border-purple-500 outline-none"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows="3"
                />
                <button
                    onClick={handleTest}
                    disabled={loading}
                    className={`px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded font-medium transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {loading ? 'Testing...' : 'Test Connection'}
                </button>
                {error && <div className="text-red-400 mt-2">Error: {error}</div>}
                {response && (
                    <div className="mt-4 p-3 bg-gray-900 rounded border border-purple-500/30">
                        <h3 className="text-sm font-semibold text-gray-400 mb-1">Response:</h3>
                        <p className="text-gray-200 whitespace-pre-wrap">{response}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GeminiTest;

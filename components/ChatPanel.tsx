
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { SparklesIcon } from './icons'; 

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (messageText: string) => void;
  isAiTyping: boolean;
  onResetChat: () => void;
  disabled?: boolean; // Added disabled prop
}

const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage, isAiTyping, onResetChat, disabled }) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = () => {
    if (inputText.trim() && !disabled) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <aside className="bg-dark-bg h-full flex flex-col shadow-lg text-dark-text-primary"> {/* Removed w-80 and border-l */}
      <div className="p-4 border-b border-dark-border flex justify-between items-center flex-shrink-0">
        <h3 className="text-lg font-semibold">AI Planning Assistant</h3>
        <button
            onClick={onResetChat}
            className="text-xs text-dark-text-secondary hover:text-dark-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reset Chat History"
            disabled={disabled} // Apply disabled prop
        >
            Reset
        </button>
      </div>

      <div className="flex-grow p-4 overflow-y-auto space-y-3 bg-dark-surface">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-xs lg:max-w-sm px-3.5 py-2.5 rounded-xl shadow-md ${
                msg.sender === 'user'
                  ? 'bg-dark-accent text-white'
                  : msg.isError 
                  ? 'bg-red-700 text-red-100 border border-red-500'
                  : 'bg-dark-card text-dark-text-primary border border-dark-border'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
              {msg.sender === 'ai' && msg.isProcessing && !msg.text && (
                 <div className="flex items-center justify-center space-x-1 pt-1">
                    <span className="text-xs text-dark-text-secondary">AI is typing</span>
                    <div className="w-1.5 h-1.5 bg-dark-text-secondary rounded-full animate-pulse delay-75"></div>
                    <div className="w-1.5 h-1.5 bg-dark-text-secondary rounded-full animate-pulse delay-150"></div>
                    <div className="w-1.5 h-1.5 bg-dark-text-secondary rounded-full animate-pulse delay-300"></div>
                </div>
              )}
            </div>
          </div>
        ))}
        {isAiTyping && messages[messages.length -1]?.sender === 'user' && !disabled && (
             <div className="flex justify-start">
                <div className="max-w-xs lg:max-w-sm px-3.5 py-2.5 rounded-xl shadow-md bg-dark-card text-dark-text-primary border border-dark-border">
                    <div className="flex items-center justify-center space-x-1">
                        <span className="text-xs text-dark-text-secondary">AI is typing</span>
                        <div className="w-1.5 h-1.5 bg-dark-text-secondary rounded-full animate-pulse delay-75"></div>
                        <div className="w-1.5 h-1.5 bg-dark-text-secondary rounded-full animate-pulse delay-150"></div>
                        <div className="w-1.5 h-1.5 bg-dark-text-secondary rounded-full animate-pulse delay-300"></div>
                    </div>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-dark-border bg-dark-bg flex-shrink-0">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={disabled ? "Select a project to chat" : "Ask AI to create tasks..."}
            className="flex-grow p-2.5 bg-dark-card border border-dark-border rounded-lg shadow-sm focus:ring-dark-accent focus:border-dark-accent text-sm text-dark-text-primary placeholder-dark-text-secondary"
            aria-label="Chat input"
            disabled={disabled} // Apply disabled prop
          />
          <button
            onClick={handleSend}
            disabled={disabled || isAiTyping || !inputText.trim()} // Apply disabled prop
            className="bg-dark-accent hover:bg-dark-accent-hover text-white font-semibold p-2.5 rounded-lg shadow-sm flex items-center justify-center transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-dark-accent focus:ring-opacity-75 disabled:opacity-60"
            aria-label="Send message"
          >
            <SparklesIcon className="w-5 h-5" /> 
          </button>
        </div>
      </div>
    </aside>
  );
};

export default ChatPanel;

import { ChatMessage } from '@/hooks/useChat';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface MessageProps {
  message: ChatMessage;
  onQuickReply?: (reply: string) => void;
}

export const Message = ({ message, onQuickReply }: MessageProps) => {
  const [selectedReply, setSelectedReply] = useState<string | null>(null);
  
  // Detect multiple choice questions and extract options
  const extractQuickReplies = (text: string): string[] => {
    // Look for questions with multiple choice patterns
    if (text.includes("What is your role at") && text.includes("Acme Corp")) {
      return ["Marketing", "Sales", "Support"];
    }
    return [];
  };

  const quickReplies = !message.isUser ? extractQuickReplies(message.message) : [];

  const handleQuickReply = (reply: string) => {
    setSelectedReply(reply);
    onQuickReply?.(reply);
  };

  return (
    <div className="mb-4">
      <div
        className={cn(
          'flex w-full',
          message.isUser ? 'justify-end' : 'justify-start'
        )}
      >
        {!message.isUser && (
          <div className="flex items-start space-x-2">
            <div className="w-8 h-8 bg-chat-avatar-border rounded-full flex items-center justify-center mt-1">
              <div className="w-5 h-5 bg-white rounded-full"></div>
            </div>
            <div
              className={cn(
                'max-w-[280px] rounded-2xl rounded-tl-sm px-4 py-3 text-sm shadow-lg',
                'bg-chat-bot-bubble text-foreground'
              )}
            >
              <p className="whitespace-pre-wrap break-words">{message.message}</p>
              <span className="block text-xs opacity-60 mt-2">
                {message.timestamp.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
            </div>
          </div>
        )}
        
        {message.isUser && (
          <div
            className={cn(
              'max-w-[280px] rounded-2xl rounded-tr-sm px-4 py-3 text-sm shadow-lg',
              'bg-chat-user-bubble text-white'
            )}
          >
            <p className="whitespace-pre-wrap break-words">{message.message}</p>
            <span className="block text-xs opacity-80 mt-2">
              {message.timestamp.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          </div>
        )}
      </div>
      
      {/* Quick Reply Buttons */}
      {quickReplies.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 ml-10">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              onClick={() => handleQuickReply(reply)}
              disabled={selectedReply !== null}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                'border border-gray-200 hover:border-chat-avatar-border',
                selectedReply === reply
                  ? 'bg-chat-quick-reply-selected text-white border-chat-quick-reply-selected'
                  : selectedReply !== null
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-chat-quick-reply text-foreground hover:bg-gray-50'
              )}
            >
              {reply}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
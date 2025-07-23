import { useEffect, useRef } from "react";
import { useChat } from "@/hooks/useChat";
import { Message } from "./Message";
import { ChatInput } from "./ChatInput";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const ChatWindow = () => {
  const {
    messages,
    isLoading,
    isSessionEnded,
    error,
    sendMessage,
    endConversation,
    startNewConversation,
  } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 1) Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 2) Focus on mount / when session restarts
  useEffect(() => {
    if (!isSessionEnded) {
      inputRef.current?.focus();
    }
  }, [isSessionEnded]);

  // 3) ANY keypress anywhere jumps focus into the input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ignore only-modifier presses
      if (e.key.length === 1) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-col h-[600px] w-full max-w-md mx-auto bg-chat-widget rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-chat-header text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <div className="w-4 h-4 bg-white rounded-full"></div>
          </div>
          <div>
            <h1 className="text-lg font-semibold">SupportAgent</h1>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-chat-online rounded-full"></div>
              <span className="text-sm opacity-90">Online Now</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-2"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
      >
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-muted-foreground py-8">
            <p>
              Welcome! How can I help you with your Philips Smartlight today?
            </p>
          </div>
        )}

        {messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            onQuickReply={sendMessage}
          />
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-chat-bot-bubble rounded-lg px-4 py-2 flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Typing...</span>
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mx-2">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <ChatInput
        onSendMessage={sendMessage}
        onEndConversation={endConversation}
        onStartNewConversation={startNewConversation}
        isLoading={isLoading}
        isSessionEnded={isSessionEnded}
        inputRef={inputRef} // ← pass the ref down
      />
    </div>
  );
};

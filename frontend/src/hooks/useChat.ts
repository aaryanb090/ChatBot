// src/hooks/useChat.ts
import { useState, useCallback } from "react";

export interface ChatMessage {
  id: string;
  message: string;
  isUser: boolean;
  timestamp: Date;
}

export interface ChatResponse {
  reply: string;
  endSession: boolean;
  session_id: string;
}

export interface ChatRequest {
  message: string;
  reset?: boolean;
  session_id?: string;
}

export const useChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionEnded, setIsSessionEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const addMessage = useCallback((message: string, isUser: boolean) => {
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      message,
      isUser,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setIsSessionEnded(false);
    setError(null);
    setSessionId(null);
  }, []);

  const sendMessage = useCallback(
    async (message: string, reset: boolean = false) => {
      if (isLoading) return;
      setIsLoading(true);
      setError(null);

      if (reset) {
        clearChat();
      }

      // show the user's message
      addMessage(message, true);

      try {
        const req: ChatRequest = {
          message,
          reset,
          session_id: reset ? undefined : sessionId || undefined,
        };

        const resp = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req),
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }

        const data: ChatResponse = await resp.json();

        // Update session ID from response
        setSessionId(data.session_id);

        // bot's reply
        addMessage(data.reply, false);

        if (data.endSession) {
          setIsSessionEnded(true);
        }
      } catch (e) {
        console.error("Chat error:", e);
        setError("Oops, something went wrong. Please try again.");
        // remove the last (failed) user message
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, addMessage, clearChat, sessionId]
  );

  // Detect pure greetings to reset the chat
  const isGreeting = useCallback((text: string) => {
    const greetings = ["hi", "hello", "hey", "greetings"];
    const norm = text.toLowerCase().trim();
    return greetings.some(
      (g) => norm === g || norm.startsWith(g + " ") || norm.startsWith(g + ",")
    );
  }, []);

  const handleSendMessage = useCallback(
    (text: string) => {
      const reset = isGreeting(text);
      return sendMessage(text, reset);
    },
    [sendMessage, isGreeting]
  );

  const endConversation = useCallback(() => {
    return sendMessage("", true);
  }, [sendMessage]);

  const startNewConversation = useCallback(() => {
    clearChat();
  }, [clearChat]);

  return {
    messages,
    isLoading,
    isSessionEnded,
    error,
    sendMessage: handleSendMessage,
    endConversation,
    startNewConversation,
    sessionId, // expose sessionId if needed for debugging
  };
};

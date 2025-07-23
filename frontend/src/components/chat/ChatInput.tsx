import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onEndConversation: () => void;
  onStartNewConversation: () => void;
  isLoading: boolean;
  isSessionEnded: boolean;
  disabled?: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
}

export const ChatInput = ({
  onSendMessage,
  onEndConversation,
  onStartNewConversation,
  isLoading,
  isSessionEnded,
  disabled = false,
  inputRef,
}: ChatInputProps) => {
  const [inputValue, setInputValue] = useState("");

  const handleSend = () => {
    if (inputValue.trim() && !isLoading && !disabled) {
      onSendMessage(inputValue.trim());
      setInputValue("");
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const inputDisabled = isLoading || disabled || isSessionEnded;

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="flex items-center space-x-2">
        {isSessionEnded ? (
          <Button
            onClick={onStartNewConversation}
            className="flex-1"
            variant="default"
          >
            Start New Conversation
          </Button>
        ) : (
          <>
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={inputDisabled}
              className={cn(
                "flex-1 bg-background border-border",
                inputDisabled && "opacity-50"
              )}
              role="textbox"
              aria-label="Type your message"
            />
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || inputDisabled}
              size="sm"
              className="px-3"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
            <Button
              onClick={onStartNewConversation}
              disabled={inputDisabled}
              variant="destructive"
              size="sm"
              className="px-3"
              aria-label="Clear conversation"
            >
              Clear
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

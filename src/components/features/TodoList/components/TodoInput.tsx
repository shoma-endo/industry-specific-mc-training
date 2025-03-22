import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface TodoInputProps {
  onAdd: (text: string) => void;
  disabled: boolean;
}

export function TodoInput({ onAdd, disabled }: TodoInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    if (input.trim() === "") return;
    onAdd(input);
    setInput("");
  };

  return (
    <div className="flex items-center space-x-2 mb-4">
      <Input
        placeholder="新しいタスクを入力..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        disabled={disabled}
      />
      <Button 
        onClick={handleSubmit}
        disabled={disabled}
      >
        追加
      </Button>
    </div>
  );
} 
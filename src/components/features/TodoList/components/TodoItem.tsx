import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TodoItem as TodoItemType } from "@/types/todo";

interface TodoItemProps {
  todo: TodoItemType;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  disabled: boolean;
}

export function TodoItemComponent({ todo, onToggle, onDelete, disabled }: TodoItemProps) {
  return (
    <div
      className="flex items-center justify-between p-2 border rounded"
    >
      <div className="flex items-center space-x-2">
        <Checkbox
          id={`todo-${todo.id}`}
          checked={todo.completed}
          onCheckedChange={() => onToggle(todo.id)}
          disabled={disabled}
        />
        <label
          htmlFor={`todo-${todo.id}`}
          className={`${
            todo.completed ? "line-through text-gray-500" : ""
          }`}
        >
          {todo.text}
        </label>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onDelete(todo.id)}
        disabled={disabled}
      >
        削除
      </Button>
    </div>
  );
} 
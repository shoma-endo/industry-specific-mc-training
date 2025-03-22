"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TodoInput } from "./components/TodoInput";
import { TodoItemComponent } from "./components/TodoItem";
import { addTodo, deleteTodo, deleteAllTodos, getTodos, toggleTodo } from "@/app/actions";
import { TodoItem } from "@/types/todo";

export function TodoList() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);

  // 初期ロード時にTodoを取得
  useEffect(() => {
    const fetchTodos = async () => {
      try {
        const fetchedTodos = await getTodos();
        setTodos(fetchedTodos);
      } catch (error) {
        console.error("Failed to fetch todos:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTodos();
  }, []);

  const handleAddTodo = async (text: string) => {
    startTransition(async () => {
      try {
        await addTodo(text);
        const updatedTodos = await getTodos();
        setTodos(updatedTodos);
      } catch (error) {
        console.error("Failed to add todo:", error);
      }
    });
  };

  const handleToggleTodo = async (id: number) => {
    startTransition(async () => {
      try {
        await toggleTodo(id);
        const updatedTodos = await getTodos();
        setTodos(updatedTodos);
      } catch (error) {
        console.error("Failed to toggle todo:", error);
      }
    });
  };

  const handleDeleteTodo = async (id: number) => {
    startTransition(async () => {
      try {
        await deleteTodo(id);
        const updatedTodos = await getTodos();
        setTodos(updatedTodos);
      } catch (error) {
        console.error("Failed to delete todo:", error);
      }
    });
  };

  const handleDeleteAllTodos = async () => {
    startTransition(async () => {
      try {
        await deleteAllTodos();
        setTodos([]);
      } catch (error) {
        console.error("Failed to delete all todos:", error);
      }
    });
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <p className="text-center">データを読み込み中...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">ToDoリスト</CardTitle>
      </CardHeader>
      <CardContent>
        <TodoInput onAdd={handleAddTodo} disabled={isPending} />
        <div className="space-y-2">
          {todos.length === 0 ? (
            <p className="text-center text-gray-500">タスクがありません</p>
          ) : (
            todos.map((todo) => (
              <TodoItemComponent
                key={todo.id}
                todo={todo}
                onToggle={handleToggleTodo}
                onDelete={handleDeleteTodo}
                disabled={isPending}
              />
            ))
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="text-sm text-gray-500">
          {todos.filter(t => t.completed).length}/{todos.length} 完了
        </div>
        {todos.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteAllTodos}
            disabled={isPending}
          >
            全て削除
          </Button>
        )}
      </CardFooter>
    </Card>
  );
} 
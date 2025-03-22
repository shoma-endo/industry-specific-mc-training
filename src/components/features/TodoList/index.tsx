"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TodoInput } from "./components/TodoInput";
import { TodoItemComponent } from "./components/TodoItem";
import { addTodo, deleteTodo, deleteAllTodos, getTodos, toggleTodo } from "@/app/actions";
import { TodoItem } from "@/types/todo";
import { useLiffContext } from "@/components/LiffProvider";
import Image from "next/image";
import { LogOut } from "lucide-react";

export function TodoList() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const { profile, logout } = useLiffContext();

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
        <div className="flex justify-between items-center">
          <CardTitle className="text-center flex-grow">ToDoリスト</CardTitle>
          <Button variant="ghost" size="icon" onClick={logout} title="ログアウト">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        {profile && (
          <div className="flex items-center justify-center gap-2 mt-2">
            {profile.pictureUrl && (
              <div className="w-10 h-10 rounded-full overflow-hidden relative">
                <Image 
                  src={profile.pictureUrl} 
                  alt={profile.displayName}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <span className="text-sm font-medium">{profile.displayName}さんのTodo</span>
          </div>
        )}
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
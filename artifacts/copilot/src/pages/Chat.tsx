import React, { useState, useEffect, useRef } from "react";
import { useListConversations, useCreateConversation, useGetConversation, useDeleteConversation, getListConversationsQueryKey, getGetConversationQueryKey } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Plus, MessageSquare, Trash2, Bot, User, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const API =
  import.meta.env.VITE_API_URL ||
  "https://workspaceapi-server-production-cef7.up.railway.app";

export function Chat() {
  const { data: conversations, isLoading: loadingConvos } = useListConversations();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);

  const createConvo = useCreateConversation();
  const deleteConvo = useDeleteConversation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (conversations && conversations.length > 0 && !activeId) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  const handleNewConversation = async () => {
    try {
      const convo = await createConvo.mutateAsync({ data: { title: "New Conversation" } });
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      setActiveId(convo.id);
      setShowSidebar(false);
    } catch (err: any) {
      toast({ title: "Failed to create conversation", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteConvo.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      if (activeId === id) { setActiveId(null); setShowSidebar(true); }
    } catch (err: any) {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    }
  };

  const handleSelectConvo = (id: number) => {
    setActiveId(id);
    setShowSidebar(false);
  };

  return (
    <div className="flex h-[calc(100dvh-7rem)] md:h-[calc(100vh-8rem)] gap-4">
      {/* Conversation Sidebar — full screen on mobile when shown */}
      <Card
        className={`
          flex-col border-border/50 bg-card/50 backdrop-blur-sm shrink-0
          md:flex md:w-80
          ${showSidebar ? "flex w-full absolute inset-0 z-10 rounded-none md:relative md:rounded-lg md:w-80" : "hidden md:flex"}
        `}
      >
        <div className="p-4 border-b border-border/50">
          <Button
            className="w-full justify-start gap-2"
            onClick={handleNewConversation}
            disabled={createConvo.isPending}
          >
            <Plus className="w-4 h-4" /> New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loadingConvos
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
              : conversations?.map((convo) => (
                  <div
                    key={convo.id}
                    onClick={() => handleSelectConvo(convo.id)}
                    className={`p-3 rounded-md cursor-pointer group flex items-center justify-between transition-colors ${
                      activeId === convo.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-secondary/50 text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <MessageSquare className="w-4 h-4 shrink-0" />
                      <div className="truncate">
                        <p className="text-sm font-medium truncate">{convo.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(convo.updatedAt), "MMM d, h:mm a")}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={(e) => handleDelete(convo.id, e)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Main Chat Area */}
      <Card
        className={`
          flex-col border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden
          md:flex flex-1
          ${!showSidebar ? "flex flex-1" : "hidden md:flex"}
        `}
      >
        {activeId ? (
          <ChatThread
            conversationId={activeId}
            onBack={() => setShowSidebar(true)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col text-muted-foreground gap-4 p-6 text-center">
            <MessageSquare className="w-12 h-12 opacity-50" />
            <div>
              <p className="font-medium mb-1">No conversation selected</p>
              <p className="text-sm">Start a new chat or select an existing one</p>
            </div>
            <Button onClick={handleNewConversation} disabled={createConvo.isPending} className="md:hidden">
              <Plus className="w-4 h-4 mr-2" /> New Chat
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function ChatThread({
  conversationId,
  onBack,
}: {
  conversationId: number;
  onBack: () => void;
}) {
  const { data: conversation, isLoading } = useGetConversation(conversationId, {
    query: { enabled: !!conversationId, queryKey: getGetConversationQueryKey(conversationId) },
  });
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation?.messages, streamingText]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
  
    if (!input.trim() || isStreaming) return;
  
    const userMessage = input.trim();
  
    setIsStreaming(true);
    setStreamingText("");
  
    // Optimistically add the user's message
    queryClient.setQueryData(
      getGetConversationQueryKey(conversationId),
      (old: any) => {
        if (!old) return old;
  
        return {
          ...old,
          messages: [
            ...(old.messages ?? []),
            {
              id: Date.now(),
              role: "user",
              content: userMessage,
              createdAt: new Date().toISOString(),
            },
          ],
        };
      },
    );
  
    try {
      console.log(
        "Sending:",
        `${API}/api/conversations/${conversationId}/messages`,
      );
      console.log("Message:", userMessage);
  
      const response = await fetch(
        `${API}/api/conversations/${conversationId}/messages`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: userMessage,
          }),
        },
      );
  
      console.log("Status:", response.status);
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          errorText || `Server returned ${response.status}`,
        );
      }
  
      if (!response.body) {
        throw new Error("Server did not return a stream.");
      }
  
      // Clear textbox only after request succeeds
      setInput("");
  
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
  
      let buffer = "";
  
      while (true) {
        const { done, value } = await reader.read();
  
        if (done) break;
  
        buffer += decoder.decode(value, {
          stream: true,
        });
  
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
  
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
  
          try {
            const event = JSON.parse(line.substring(6));
  
            if (event.done) continue;
  
            if (event.content) {
              setStreamingText((prev) => prev + event.content);
            }
          } catch (err) {
            console.error("Invalid SSE event:", err);
          }
        }
      }
  
      console.log("Streaming complete");
  
      await queryClient.invalidateQueries({
        queryKey: getGetConversationQueryKey(conversationId),
      });
    } catch (error: any) {
      console.error("Streaming error:", error);
  
      toast({
        title: "Message failed",
        description: error.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsStreaming(false);
      setStreamingText("");
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Skeleton className="w-64 h-8" />
      </div>
    );
  }

  return (
    <>
      <div className="p-3 md:p-4 border-b border-border/50 font-medium flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 md:hidden shrink-0"
          onClick={onBack}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="truncate">{conversation?.title || "Conversation"}</span>
      </div>
      <ScrollArea className="flex-1 p-3 md:p-4">
        <div className="space-y-4 md:space-y-6 pr-2 md:pr-4" ref={scrollRef}>
          {conversation?.messages?.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 md:gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {msg.role === "user" ? (
                  <User className="w-3 h-3 md:w-4 md:h-4" />
                ) : (
                  <Bot className="w-3 h-3 md:w-4 md:h-4" />
                )}
              </div>
              <div
                className={`rounded-lg p-2.5 md:p-3 max-w-[85%] md:max-w-[80%] text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 text-foreground"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isStreaming && (
            <div className="flex gap-2 md:gap-4">
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
                <Bot className="w-3 h-3 md:w-4 md:h-4" />
              </div>
              <div className="rounded-lg p-2.5 md:p-3 max-w-[85%] md:max-w-[80%] text-sm whitespace-pre-wrap bg-secondary/50 text-foreground">
                {streamingText}
                <span className="inline-block w-1.5 h-4 ml-1 bg-primary animate-pulse" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="p-3 md:p-4 border-t border-border/50">
        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your documents..."
            className="flex-1 bg-secondary/20 text-sm"
            disabled={isStreaming}
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isStreaming}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </>
  );
}

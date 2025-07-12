import "dotenv/config";
import { clearSearchBar, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { useCallback, useMemo, useRef, useState } from "react";
import say from "say";
import { v4 as uuidv4 } from "uuid";
import { Chat, ChatHook, Model } from "../type";
import { buildUserMessage, chatTransformer } from "../utils";
import { useAutoTTS } from "./useAutoTTS";
import { getApiConfig } from "./useChatGPT";
import { useHistory } from "./useHistory";
import { useProxy } from "./useProxy";
import { ChatCompletion, ChatCompletionChunk } from "openai/resources/chat/completions";
import { Stream } from "openai/streaming";

export function useChat<T extends Chat>(props: T[]): ChatHook {
  const [data, setData] = useState<Chat[]>(props);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [isAborted, setIsAborted] = useState<boolean>(false);
  const [useStream] = useState<boolean>(() => {
    return getPreferenceValues<{
      useStream: boolean;
    }>().useStream;
  });
  const [streamData, setStreamData] = useState<Chat | undefined>();
  const abortControllerRef = useRef<AbortController | null>(null);

  const [isHistoryPaused] = useState<boolean>(() => {
    return getPreferenceValues<{
      isHistoryPaused: boolean;
    }>().isHistoryPaused;
  });

  const history = useHistory();
  const isAutoTTS = useAutoTTS();
  const proxy = useProxy();

  async function ask(question: string, files: string[], model: Model) {
    clearSearchBar();
    setLoading(true);
    const toast = await showToast({
      title: "Getting your answer...",
      style: Toast.Style.Animated,
    });
    let chat: Chat = {
      id: uuidv4(),
      question,
      files,
      answer: "",
      created_at: new Date().toISOString(),
    };
    setData((prev) => [...prev, chat]);
    setTimeout(async () => setSelectedChatId(chat.id), 50);

    const { endpoint, token } = getApiConfig();
    if (!endpoint) {
      setErrorMsg("API endpoint is undefined. Please check your .env or configuration.");
      await showToast({
        title: "API endpoint is undefined",
        message: "Check your .env or configuration for API_ENDPOINT",
        style: Toast.Style.Failure,
      });
      setLoading(false);
      return;
    }
    if (!token) {
      setErrorMsg("Bearer token is undefined. Please check your .env or configuration.");
      await showToast({
        title: "Bearer token is undefined",
        message: "Check your .env or configuration for BEARER_TOKEN",
        style: Toast.Style.Failure,
      });
      setLoading(false);
      return;
    }
    abortControllerRef.current = new AbortController();
    const { signal: abortSignal } = abortControllerRef.current;
    try {
      const response = await fetch(`${endpoint}/api/ai-gateway/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: model.option,
          messages: [
            ...chatTransformer(data.reverse(), model.prompt),
            { role: "user", content: buildUserMessage(question, files) },
          ],
          temperature: Number(model.temperature),
          max_tokens: 500,
        }),
        signal: abortSignal,
      });
      let errorDetail = "";
      if (!response.ok) {
        try {
          const text = await response.text();
          try {
            const json = JSON.parse(text);
            errorDetail = JSON.stringify(json, null, 2);
          } catch {
            errorDetail = text;
          }
        } catch (e) {
          errorDetail = `Failed to parse error response: ${e}`;
        }
        throw new Error(errorDetail || `HTTP error: ${response.status}`);
      }
      const result = await response.json();
      chat = { ...chat, answer: result.choices?.[0]?.message?.content ?? "" };
      if (isAutoTTS) {
        say.stop();
        say.speak(chat.answer);
      }
      setLoading(false);
      toast.title = "Got your answer!";
      toast.style = Toast.Style.Success;
      setData((prev) => prev.map((a) => (a.id === chat.id ? chat : a)));
      if (!isHistoryPaused) await history.add(chat);
    } catch (err: any) {
      console.error("Chat API error:", err);
      if (abortSignal.aborted) {
        toast.title = "Request canceled";
        toast.message = undefined;
        setIsAborted(true);
      } else {
        toast.title = `Error: ${err?.name || "Unknown"}`;
        toast.message = err?.message || JSON.stringify(err) || String(err);
        setErrorMsg(err?.message || JSON.stringify(err) || String(err));
      }
      toast.style = Toast.Style.Failure;
      setLoading(false);
    }
  }

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const clear = useCallback(async () => {
    setData([]);
  }, [setData]);

  return useMemo(
    () => ({
      data,
      errorMsg,
      setData,
      isLoading,
      setLoading,
      isAborted,
      setIsAborted,
      selectedChatId,
      setSelectedChatId,
      ask,
      clear,
      streamData,
      abort,
    }),
    [
      data,
      errorMsg,
      setData,
      isLoading,
      setLoading,
      isAborted,
      setIsAborted,
      selectedChatId,
      setSelectedChatId,
      ask,
      clear,
      streamData,
      abort,
    ],
  );
}

export function getApiConfig() {
  const preferences = getPreferenceValues();
  return {
    endpoint: preferences.apiEndpoint,
    token: preferences.bearerToken,
  };
}

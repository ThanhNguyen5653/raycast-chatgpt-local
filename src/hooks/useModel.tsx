import { LocalStorage, showToast, Toast } from "@raycast/api";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Model, ModelHook } from "../type";
import { getConfiguration, getApiConfig } from "./useChatGPT";
import { useProxy } from "./useProxy";

export const DEFAULT_MODEL: Model = {
  id: "default",
  updated_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  name: "Default",
  prompt: "You are a helpful assistant.",
  option: "gpt-4o-mini",
  temperature: "1",
  pinned: false,
  vision: false,
};

export function useModel(): ModelHook {
  const [data, setData] = useState<Record<string, Model>>({});
  const [isLoading, setLoading] = useState<boolean>(true);
  const [isFetching, setFetching] = useState<boolean>(true);
  const proxy = useProxy();
  const { useAzure, isCustomModel } = getConfiguration();
  const [option, setOption] = useState<Model["option"][]>([
    "gpt-4o-mini",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "llama-3.3-70b",
    "exaone-deep-32b",
    "exaone-3-5-32b-instruct",
    "deepseek-r1-distill-llama-70b",
    "mythomax-l2-13b-lite",
    "Llama-3.2-11B-Vision-Instruct",
    "gemini-2.0-flash",
    "gemini-2.5-flash-preview-04-17",
    "cheap-summarizer",
  ]);

  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isCustomModel) {
      setFetching(false);
      return;
    }
    // Remove OpenAI SDK model listing. Optionally, fetch from your custom endpoint if supported.
    setFetching(false);
  }, [isCustomModel]);

  useEffect(() => {
    (async () => {
      const storedModels: Model[] | Record<string, Model> = JSON.parse(
        (await LocalStorage.getItem<string>("models")) || "{}",
      );
      const storedModelsLength = ((models: Record<string, Model> | Model[]): number =>
        Array.isArray(models) ? models.length : Object.keys(models).length)(storedModels);

      if (storedModelsLength === 0) {
        setData({ [DEFAULT_MODEL.id]: DEFAULT_MODEL });
      } else {
        let modelsById: Record<string, Model>;
        // Support for old data structure
        if (Array.isArray(storedModels)) {
          modelsById = storedModels.reduce((acc, model) => ({ ...acc, [model.id]: model }), {});
        } else {
          modelsById = storedModels;
        }
        if (!modelsById[DEFAULT_MODEL.id]) {
          modelsById[DEFAULT_MODEL.id] = DEFAULT_MODEL;
        }
        setData(modelsById);
      }
      setLoading(false);
      isInitialMount.current = false;
    })();
  }, []);

  useEffect(() => {
    // Avoid saving when initial loading
    if (isInitialMount.current) {
      return;
    }
    LocalStorage.setItem("models", JSON.stringify(data));
  }, [data]);

  const add = useCallback(
    async (model: Model) => {
      const toast = await showToast({
        title: "Saving your model...",
        style: Toast.Style.Animated,
      });
      setData((prevData) => ({ ...prevData, [model.id]: { ...model, created_at: new Date().toISOString() } }));
      toast.title = "Model saved!";
      toast.style = Toast.Style.Success;
    },
    [setData],
  );

  const update = useCallback(
    async (model: Model) => {
      const toast = await showToast({
        title: "Updating your model...",
        style: Toast.Style.Animated,
      });
      setData((prevData) => ({
        ...prevData,
        [model.id]: {
          ...prevData[model.id],
          ...model,
          updated_at: new Date().toISOString(),
        },
      }));
      toast.title = "Model updated!";
      toast.style = Toast.Style.Success;
    },
    [setData],
  );

  const remove = useCallback(
    async (model: Model) => {
      const toast = await showToast({
        title: "Removing your model...",
        style: Toast.Style.Animated,
      });
      setData((prevData) => {
        const newData = { ...prevData };
        delete newData[model.id];
        return newData;
      });
      toast.title = "Model removed!";
      toast.style = Toast.Style.Success;
    },
    [setData],
  );

  const clear = useCallback(async () => {
    const toast = await showToast({
      title: "Clearing your models ...",
      style: Toast.Style.Animated,
    });
    setData({ [DEFAULT_MODEL.id]: DEFAULT_MODEL });
    toast.title = "Models cleared!";
    toast.style = Toast.Style.Success;
  }, [setData]);

  const setModels = useCallback(
    async (models: Record<string, Model>) => {
      setData(models);
    },
    [setData],
  );

  return useMemo(
    () => ({ data, isLoading, option, add, update, remove, clear, setModels, isFetching }),
    [data, isLoading, option, add, update, remove, clear, setModels, isFetching],
  );
}

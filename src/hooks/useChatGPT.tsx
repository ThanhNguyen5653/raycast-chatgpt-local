import { useState, useCallback } from "react";
import { getPreferenceValues } from "@raycast/api";

export function getApiConfig() {
  const preferences = getPreferenceValues();
  return {
    endpoint: preferences.apiEndpoint,
    token: preferences.bearerToken,
  };
}

export function getConfiguration() {
  const preferences = getPreferenceValues<Preferences>();
  return {
    useAzure: preferences.useAzure || false,
    isCustomModel: preferences.isCustomModel || false,
  };
}

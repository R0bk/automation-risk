"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ApiKeyInputProps {
  disabled: boolean;
  onApiKeyChange: (apiKey: string) => void;
}

export function ApiKeyInput({ disabled, onApiKeyChange }: ApiKeyInputProps) {
  const [apiKey, setApiKey] = useState("");
  const [showInput, setShowInput] = useState(false);

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    onApiKeyChange(value);
  };

  if (!disabled) return null;

  if (!showInput) {
    return (
      <div className="mt-6 rounded-lg border border-[rgba(245,78,0,0.15)] bg-[rgba(245,78,0,0.04)] p-4">
        <p className="text-sm text-[#26251e]/70 mb-3">
          Public run budget exhausted. Use your own Anthropic API key to continue.
        </p>
        <Button
          onClick={() => setShowInput(true)}
          className="h-10 rounded-full px-6 text-xs font-semibold uppercase tracking-[0.24em] bg-[linear-gradient(120deg,#f54e00,#ff9440)] text-white shadow-[0_12px_24px_rgba(245,78,0,0.25)] hover:shadow-[0_16px_32px_rgba(245,78,0,0.35)]"
        >
          Use my API key
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-[rgba(245,78,0,0.15)] bg-[rgba(245,78,0,0.04)] p-4 space-y-3">
      <p className="text-sm text-[#26251e]/70">
        Enter your Anthropic API key (starts with "sk-ant-")
      </p>
      <input
        type="password"
        value={apiKey}
        onChange={(e) => handleApiKeyChange(e.target.value)}
        placeholder="sk-ant-..."
        className="w-full rounded-md border border-[rgba(38,37,30,0.2)] bg-white px-4 py-2 text-sm text-[#26251e] outline-none focus:border-[#f54e00] focus:ring-2 focus:ring-[rgba(245,78,0,0.15)]"
      />
      <p className="text-xs text-[#26251e]/60">
        Your API key is only used for this run and is never stored.
      </p>
    </div>
  );
}

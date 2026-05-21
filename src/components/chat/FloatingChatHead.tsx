import React, { useEffect, useRef, useState } from 'react';
import { Send, X, MessageCircle, BookmarkPlus, Check, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MessageContent } from './MessageContent';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useDogProfiles } from '../../hooks/useDogProfiles';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useRecipes } from '../../hooks/useRecipes';
import { chatWithAssistant, extractRecipeFromText, looksLikeRecipe } from '../../utils/assistantChat';
import { recipeFromChatJson, validateChatRecipe } from '../../utils/chatRecipeConverter';
import { generateId } from '../../utils/storage';
import type { ChatMessage } from '../../types/assistant';

const QUICK_PROMPTS = [
  'How much should I feed my dog today?',
  'How do I steam carrots?',
  'What supplements does my dog need?',
];

const EXTRACT_FAIL_MESSAGE =
  "Couldn't extract a clean recipe. Try asking Cheffo Doggo to list ingredients with amounts in grams.";

export function FloatingChatHead() {
  const { user } = useAuth();
  const { activeProfile } = useDogProfiles();
  const { saveRecipe } = useRecipes();

  const storageKey = `assistant-messages:${user?.id ?? 'guest'}`;
  const [messages, setMessages] = useLocalStorage<ChatMessage[]>(storageKey, []);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [extractingForId, setExtractingForId] = useState<string | null>(null);
  const [savingRecipeForId, setSavingRecipeForId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<{ id: string; message: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, isOpen]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    const assistantId = generateId();
    const assistantPlaceholder: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };

    const history = messages;
    setMessages(prev => [...prev, userMessage, assistantPlaceholder]);
    setInput('');
    setLoading(true);

    try {
      const result = await chatWithAssistant({
        history,
        userMessage: trimmed,
        dogProfile: activeProfile,
        onChunk: visible => {
          setMessages(prev => prev.map(m => (m.id === assistantId ? { ...m, content: visible } : m)));
        },
      });

      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: result.text, parsedRecipe: result.parsedRecipe ?? undefined }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function handleClearConversation() {
    if (messages.length === 0) return;
    const confirmed = window.confirm('Clear all messages with Cheffo Doggo? Saved recipes are unaffected — only this conversation will be cleared.');
    if (!confirmed) return;
    setMessages([]);
    setSaveError(null);
  }

  async function handleSaveRecipe(message: ChatMessage) {
    if (!activeProfile || extractingForId || savingRecipeForId) return;
    setSaveError(null);
    try {
      let parsed = message.parsedRecipe;
      if (!parsed) {
        setExtractingForId(message.id);
        parsed = (await extractRecipeFromText(message.content)) ?? undefined;
        setExtractingForId(null);
        if (!parsed) {
          setSaveError({ id: message.id, message: EXTRACT_FAIL_MESSAGE });
          return;
        }
        setMessages(prev =>
          prev.map(m => (m.id === message.id ? { ...m, parsedRecipe: parsed } : m))
        );
      }

      const safetyErrors = validateChatRecipe(parsed, activeProfile);
      if (safetyErrors.length > 0) {
        setSaveError({
          id: message.id,
          message: `This recipe can't be saved for ${activeProfile.name}: ${safetyErrors.join(' ')}`,
        });
        return;
      }

      setSavingRecipeForId(message.id);
      const recipe = await recipeFromChatJson(parsed, activeProfile);
      const saved = await saveRecipe(recipe);
      setMessages(prev =>
        prev.map(m => (m.id === message.id ? { ...m, parsedRecipe: parsed, savedRecipeId: saved.id } : m))
      );
    } catch (error) {
      console.error('[FloatingChatHead] saveRecipe failed', error);
      setSaveError({ id: message.id, message: EXTRACT_FAIL_MESSAGE });
    } finally {
      setExtractingForId(null);
      setSavingRecipeForId(null);
    }
  }

  // Closed state: floating circular button
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 grid h-16 w-16 place-items-center rounded-full border-2 border-white bg-[#f97316] shadow-lg shadow-[#f97316]/30 transition-transform hover:scale-105 sm:bottom-6 sm:right-6"
        aria-label="Open Cheffo Doggo chat"
      >
        <img
          src="/cheffo-doggo-logo.png"
          alt=""
          className="h-14 w-14 rounded-full object-contain"
        />
        <span className="absolute -top-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-white text-[#f97316] shadow ring-2 ring-[#f97316]">
          <MessageCircle size={13} fill="currentColor" />
        </span>
      </button>
    );
  }

  // Open state: chat panel
  return (
    <div
      className="fixed bottom-4 right-4 z-40 flex h-[min(560px,calc(100vh-2rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-[#eadfce] bg-[#fffbf5] shadow-2xl sm:bottom-6 sm:right-6"
      role="dialog"
      aria-label="Cheffo Doggo chat"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#eadfce] bg-white px-4 py-3">
        <img src="/cheffo-doggo-logo.png" alt="" className="h-10 w-10 rounded-full border border-[#eadfce] object-contain" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#2b2118]">Cheffo Doggo</p>
          <p className="flex items-center gap-1.5 text-xs text-[#4f8f64]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#43a365]" />
            Vet · nutrition · supplements
          </p>
        </div>
        <button
          type="button"
          onClick={handleClearConversation}
          disabled={messages.length === 0 || loading}
          className="grid h-8 w-8 place-items-center rounded-full text-[#7f7469] transition-colors hover:bg-[#fff3e5] hover:text-[#b46251] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#7f7469]"
          title="Clear this conversation"
          aria-label="Clear conversation"
        >
          <Trash2 size={15} />
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="grid h-8 w-8 place-items-center rounded-full text-[#7f7469] transition-colors hover:bg-[#fff3e5] hover:text-[#2b2118]"
          aria-label="Close chat"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-[#eadfce] bg-white px-3 py-3 text-sm leading-relaxed text-[#3a302a]">
            <p>Hi! I'm Cheffo Doggo — your homemade dog food assistant.{activeProfile?.name ? ` I see you have a profile for ${activeProfile.name}.` : ''} What can I help you with?</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="rounded-full border border-[#f2c8a0] bg-[#fff7ee] px-2.5 py-1 text-xs font-medium text-[#a16b38] hover:bg-[#fff1df]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(message => (
          <div key={message.id} className={['flex flex-col', message.role === 'user' ? 'items-end' : 'items-start'].join(' ')}>
            <div className={[
              'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
              message.role === 'user'
                ? 'rounded-br-md bg-[#fff1df] text-[#453729] border border-[#f4d8b7]'
                : 'rounded-bl-md bg-white border border-[#eadfce] text-[#2b2118]',
            ].join(' ')}>
              {message.role === 'assistant' && !message.content && loading
                ? <span className="text-[#9a9186]">…</span>
                : <MessageContent content={message.content} />}
            </div>
            {message.role === 'assistant' && message.content && (message.parsedRecipe || looksLikeRecipe(message.content)) && (
              <div className="mt-1.5 max-w-[85%]">
                {message.savedRecipeId ? (
                  <Link
                    to={`/recipes/${message.savedRecipeId}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#d6ebda] bg-[#f2fbf4] px-2.5 py-1 text-xs font-semibold text-[#43a365] hover:bg-[#e6f7eb]"
                  >
                    <Check size={12} />
                    Saved · open recipe
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleSaveRecipe(message)}
                      disabled={!activeProfile || extractingForId === message.id || savingRecipeForId === message.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#f2c8a0] bg-[#fff7ee] px-2.5 py-1 text-xs font-semibold text-[#a16b38] hover:bg-[#fff1df] disabled:cursor-not-allowed disabled:opacity-60"
                      title={activeProfile ? 'Save this recipe to your list' : 'Add a dog profile first to save recipes'}
                    >
                      <BookmarkPlus size={12} />
                      {extractingForId === message.id
                        ? 'Extracting…'
                        : savingRecipeForId === message.id
                        ? 'Saving…'
                        : 'Save to my recipes'}
                    </button>
                    {saveError && saveError.id === message.id && (
                      <p className="mt-1 text-[11px] text-[#b46251]">
                        {saveError.message}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[#eadfce] bg-white px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Ask Cheffo Doggo…"
            className="flex-1 rounded-full border border-[#eadfce] bg-[#fffbf5] px-3 py-2 text-sm focus:border-[#f97316] focus:outline-none"
          />
          <Button
            size="sm"
            icon={<Send size={14} />}
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
          />
        </div>
      </div>
    </div>
  );
}

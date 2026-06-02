import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, BookmarkPlus, Check, Trash2, Sparkles } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { MessageContent } from '../../components/chat/MessageContent';
import { UpgradeModal } from '../../components/paywall/UpgradeModal';
import { useDogProfiles } from '../../hooks/useDogProfiles';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useRecipes } from '../../hooks/useRecipes';
import { usePaywall } from '../../hooks/usePaywall';
import { useAuth } from '../../contexts/AuthContext';
import { chatWithAssistant, extractRecipeFromText, looksLikeRecipe } from '../../utils/assistantChat';
import { SHORT_VET_DISCLAIMER } from '../../utils/safetyValidator';
import { recipeFromChatJson, validateChatRecipe } from '../../utils/chatRecipeConverter';
import { generateId } from '../../utils/storage';
import type { ChatMessage } from '../../types/assistant';

const STARTER_CHAT: ChatMessage[] = [
  {
    id: 's1',
    role: 'user',
    content: 'Hi Cheffo Doggo! How much homemade food should I feed my 25 lb, 2-year-old dog?',
    timestamp: new Date().toISOString(),
  },
  {
    id: 's2',
    role: 'assistant',
    content:
      'For a healthy, moderate activity 25 lb dog, a good starting point is about 2 to 2.5% of ideal body weight daily. That is roughly 8 to 10 oz (1 to 1¼ cups), split into 2 meals. Adjust using body condition and recipe calorie density.',
    timestamp: new Date().toISOString(),
  },
];

const EXTRACT_FAIL_MESSAGE =
  "Couldn't extract a clean recipe. Try asking Cheffo Doggo to list ingredients with amounts in grams.";

export default function AssistantPage() {
  const { activeProfile } = useDogProfiles();
  const { user } = useAuth();
  const { saveRecipe } = useRecipes();
  const chatStorageKey = `assistant-messages:${user?.id ?? 'guest'}`;
  const [messages, setMessages] = useLocalStorage<ChatMessage[]>(chatStorageKey, STARTER_CHAT);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [extractingForId, setExtractingForId] = useState<string | null>(null);
  const [savingRecipeForId, setSavingRecipeForId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<{ id: string; message: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { canUseFeature, requireUpgrade, upgradePrompt, dismissUpgradePrompt, isPremium, isLoading: paywallLoading } = usePaywall();
  // While subscription state loads, don't show the feature as blocked (a
  // premium user is briefly isPremium=false otherwise).
  const assistantAllowed = paywallLoading || canUseFeature('assistant');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    if (paywallLoading) return; // subscription not resolved yet — ignore click
    if (!canUseFeature('assistant')) {
      requireUpgrade('assistant');
      return;
    }

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
    } catch (error) {
      console.error('[AssistantPage] chat send failed', error);
      // Replace the empty placeholder with a visible error message so the
      // user isn't stuck staring at a blank bubble. The user can retry by
      // re-sending the same prompt.
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? {
                ...m,
                content: "⚠️ Sorry, I couldn't reach Cheffo Doggo just now. Check your connection and try again.",
              }
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
      console.error('[AssistantPage] saveRecipe failed', error);
      setSaveError({ id: message.id, message: EXTRACT_FAIL_MESSAGE });
    } finally {
      setExtractingForId(null);
      setSavingRecipeForId(null);
    }
  }

  return (
    <AppShell
      active="assistant"
      rightRail={
        <>
          <section className="doggo-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[1.3rem] font-semibold">Your Dog Context</h3>
              {activeProfile && (
                <Link to={`/profiles/${activeProfile.id}/edit`} className="text-sm font-semibold text-[#f97316]">
                  Edit
                </Link>
              )}
            </div>
            {activeProfile ? (
              <div className="mt-3 rounded-2xl border border-[#eadfce] bg-white p-3">
                <div className="flex items-center gap-3">
                  <img src="/cheffo-doggo-logo.png" alt="Dog" className="h-16 w-16 rounded-full border border-[#eadfce] object-contain" />
                  <div>
                    <p className="font-semibold">{activeProfile.name}</p>
                    <p className="text-sm text-[#7f7469]">
                      {activeProfile.breed}
                      {activeProfile.ageYears != null && ` · ${activeProfile.ageYears} yrs`}
                    </p>
                    {activeProfile.idealWeightLbs != null && (
                      <p className="mt-1 inline-block rounded-lg bg-[#fff1df] px-2 py-0.5 text-xs text-[#a16b38]">
                        Ideal Weight: {activeProfile.idealWeightLbs} lbs
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-dashed border-[#eadfce] bg-white p-4 text-center">
                <p className="text-sm font-medium text-[#6f6459]">No dog profile yet</p>
                <p className="mt-1 text-xs text-[#9a9186]">Add one for personalized answers tailored to your pup.</p>
                <Link
                  to="/profiles/new"
                  className="mt-3 inline-block rounded-xl bg-[#f97316] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#ea6a0c]"
                >
                  Add Dog Profile
                </Link>
              </div>
            )}
          </section>

          <section className="doggo-card p-5">
            <h4 className="text-[1.2rem] font-semibold">Common Questions</h4>
            <div className="mt-3 space-y-2 text-sm">
              {['How much should I feed my dog?', 'Can I use human supplements?', 'What ingredients should I avoid?', 'How do I transition to homemade?'].map(q => (
                <button key={q} onClick={() => sendMessage(q)} className="w-full rounded-xl border border-[#eadfce] bg-white px-3 py-2 text-left text-[#6f6459] hover:bg-[#fff8ef]">
                  {q}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-[#d6ebda] bg-[#f2fbf4] p-5 text-sm text-[#4f8f64]">
            <h4 className="font-semibold">Safety First</h4>
            <ul className="mt-2 space-y-1 text-xs text-[#5f8b6a]">
              <li>• Advice is based on safe, vet-reviewed ingredients.</li>
              <li>• No onions, garlic, grapes, raisins, or xylitol.</li>
              <li>• When in doubt, ask your vet.</li>
            </ul>
          </section>

          <section className="doggo-card p-5">
            <h4 className="text-[1.2rem] font-semibold">Popular Topics</h4>
            <ul className="mt-2 space-y-1 text-sm text-[#6f6459]">
              <li>📦 Portion Sizes & Calorie Needs</li>
              <li>🥬 Safe Ingredient Swaps</li>
              <li>🍲 Transitioning to Homemade</li>
              <li>🩺 Allergies & Sensitivities</li>
            </ul>
          </section>
        </>
      }
    >
      <section className="doggo-soft-card p-7">
        <div className="grid items-center gap-6 lg:grid-cols-[1.2fr_280px]">
          <div>
            <h1 className="doggo-section-title">Ask Cheffo Doggo 🐾</h1>
            <p className="mt-2 text-[1.2rem] text-[#7f7469]">Your AI assistant for homemade dog food questions, personalized for your pup.</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#d6ebda] bg-[#f2fbf4] px-4 py-2 text-sm font-semibold text-[#4f8f64]">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#43a365]" />
              AI Assistant · Always here to help
            </div>
          </div>
          <img src="/cheffo-doggo-logo.png" alt="Cheffo Doggo mascot" className="mx-auto h-48 w-48 object-contain" />
        </div>
      </section>

      <section className="mt-4 doggo-card flex h-[62vh] flex-col p-4">
        <p className="mb-3 rounded-xl border border-[#e7e5e4] bg-[#fafaf9] px-3 py-2 text-xs leading-relaxed text-[#78716C]">
          {SHORT_VET_DISCLAIMER}
        </p>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#7f7469]">
            {messages.length} message{messages.length === 1 ? '' : 's'}
          </p>
          <button
            type="button"
            onClick={handleClearConversation}
            disabled={messages.length === 0 || loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#eadfce] bg-white px-3 py-1 text-xs font-semibold text-[#7f7469] transition-colors hover:border-[#f2c8a0] hover:text-[#b46251] disabled:cursor-not-allowed disabled:opacity-40"
            title="Clear this conversation"
          >
            <Trash2 size={13} />
            Clear conversation
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.map(message => (
            <div key={message.id} className={['flex flex-col', message.role === 'user' ? 'items-end' : 'items-start'].join(' ')}>
              <div className={[
                'max-w-[78%] rounded-3xl px-4 py-3 text-sm leading-relaxed',
                message.role === 'user'
                  ? 'rounded-br-md bg-[#fff1df] text-[#453729] border border-[#f4d8b7]'
                  : 'rounded-bl-md bg-white border border-[#eadfce] text-[#2b2118]',
              ].join(' ')}>
                {message.role === 'assistant' && !message.content && loading
                  ? <span className="text-[#9a9186]">…</span>
                  : <MessageContent content={message.content} />}
                <p className="mt-1 text-right text-xs text-[#9a9186]">
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {message.role === 'assistant' && message.content && (message.parsedRecipe || looksLikeRecipe(message.content)) && (
                <div className="mt-1.5 max-w-[78%]">
                  {message.savedRecipeId ? (
                    <Link
                      to={`/recipes/${message.savedRecipeId}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#d6ebda] bg-[#f2fbf4] px-3 py-1 text-xs font-semibold text-[#43a365] hover:bg-[#e6f7eb]"
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
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#f2c8a0] bg-[#fff7ee] px-3 py-1 text-xs font-semibold text-[#a16b38] hover:bg-[#fff1df] disabled:cursor-not-allowed disabled:opacity-60"
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

        {!isPremium && !assistantAllowed && (
          <div className="mt-3 rounded-2xl border border-[#f4ddc1] bg-[#fff8ee] p-4 text-sm text-[#7e6b54]">
            <p className="font-semibold text-[#5b4a37] flex items-center gap-1.5">
              <Sparkles size={14} className="text-[#f97316]" aria-hidden="true" />
              Ask Cheffo Doggo is a Premium feature
            </p>
            <p className="mt-1">
              Personalized canine-nutrition chat — portions, supplements, transitions, ingredient swaps — is part of Cheffo Doggo Premium. $8/mo or $59/yr with a 14-day money-back guarantee.
            </p>
          </div>
        )}

        <div className="mt-3 rounded-2xl border border-[#eadfce] bg-white p-2">
          <div className="mb-2 flex flex-wrap gap-2 px-1">
            {['How do I adjust portions for weight loss?', 'What veggies are safe for dogs?', 'Can I add eggs to recipes?'].map(prompt => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="rounded-full border border-[#eadfce] bg-[#fff9f0] px-3 py-1 text-xs font-medium text-[#7a6f64]"
              >
                {prompt}
              </button>
            ))}
          </div>
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
              placeholder={assistantAllowed ? 'Ask Cheffo Doggo anything about homemade dog food...' : 'Upgrade to Premium to chat with Cheffo Doggo'}
              className="doggo-input flex-1 border-none"
            />
            <Button
              icon={assistantAllowed ? <Send size={15} /> : <Sparkles size={15} />}
              onClick={() => (assistantAllowed ? sendMessage(input) : requireUpgrade('assistant'))}
              disabled={loading || (assistantAllowed && !input.trim())}
            />
          </div>
        </div>
      </section>
      <UpgradeModal
        open={upgradePrompt.open}
        onClose={dismissUpgradePrompt}
        feature={upgradePrompt.feature}
      />
    </AppShell>
  );
}

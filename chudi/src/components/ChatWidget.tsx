import React from 'react';
import { Mic } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { chatAssistant } from '../services/api';
import { bottomwearProducts } from '../data/bottomwearProducts';
import { dupattaProducts } from '../data/dupattaProducts';
import { products as kurtiProducts } from '../data/products';
import { parseNaturalLanguageSearch } from '../utils/searchParser';
import '../styles/ChatWidget.css';

type Sender = 'user' | 'bot';

interface Recommendation {
  id: number;
  name: string;
  color: string;
  price: number;
  image_url?: string;
  category?: string;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<SpeechRecognitionAlternativeLike>>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
}

type SpeechRecognitionFactory = new () => SpeechRecognitionLike;

interface ChatMessage {
  id: number;
  sender: Sender;
  text: string;
  links?: Recommendation[];
}

type ShopCategory = 'kurti' | 'bottomwear' | 'dupatta';

const BOTTOMWEAR_STYLE_MAP: Record<string, string> = {
  leggings: 'Leggins',
  leggins: 'Leggins',
  legging: 'Leggins',
  palazzo: 'Palazzo Pants',
  palazzos: 'Palazzo Pants',
  'straight pant': 'Straight Pants',
  'straight pants': 'Straight Pants',
  'straight': 'Straight Pants',
  'bell bottom': 'Bell Bottom Pants',
  'bell bottom pants': 'Bell Bottom Pants',
  'wide leg': 'Wide Leg Pants',
  'wide leg pants': 'Wide Leg Pants',
  'printed palazzo': 'Printed Palazzo Pants',
};

const DUPATTA_STYLE_MAP: Record<string, string> = {
  casual: 'Casual Dupatta',
  festive: 'Festive Dupatta',
  'multi colour': 'Multi Colour Dupatta',
  multicolour: 'Multi Colour Dupatta',
  multicolor: 'Multi Colour Dupatta',
};

const KURTI_STYLE_MAP: Record<string, string> = {
  anarkali: 'Anarkali',
  casual: 'Casual',
  chikankari: 'Chikankari',
  formal: 'Formal',
  short: 'Short',
  silk: 'Silk',
};

const getWelcomeMessage = (category?: ShopCategory | null) => {
  if (category === 'bottomwear') {
    return 'Hi! Looking for bottomwear? Tell me a color, size, or budget to get started.';
  }
  if (category === 'dupatta') {
    return 'Hi! Looking for dupatta? Tell me a color, fabric, or budget to get started.';
  }
  return 'Hi! What are you looking for today - kurti, bottomwear, or dupatta?';
};

const buildAnalysisSummary = (query: string) => {
  const parsed = parseNaturalLanguageSearch(query);
  const summary: string[] = [];
  if (parsed.filters.color) summary.push(`color: ${parsed.filters.color}`);
  if (parsed.filters.size) summary.push(`size: ${parsed.filters.size}`);
  if (parsed.filters.min_price !== undefined) summary.push(`above Rs ${parsed.filters.min_price}`);
  if (parsed.filters.max_price !== undefined) summary.push(`under Rs ${parsed.filters.max_price}`);
  return { parsed, summary };
};

const normalizeText = (value: string) =>
  value.toLowerCase().replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();

const squashText = (value: string) => normalizeText(value).replace(/\s+/g, '');

const containsDupattaLike = (value: string) => {
  const squashed = squashText(value);
  return (
    squashed.includes('dupatta') ||
    squashed.includes('dupata') ||
    squashed.includes('duppatta') ||
    squashed.includes('dupat') ||
    squashed.includes('duoataa') ||
    squashed.includes('duoata')
  );
};

const findMatch = (text: string, options: Record<string, string>): string | null => {
  const normalized = normalizeText(text);
  for (const key of Object.keys(options)) {
    if (normalized.includes(key)) {
      return options[key];
    }
  }
  return null;
};

const extractSize = (text: string): string | null => {
  const normalized = normalizeText(text).toUpperCase();
  const match = normalized.match(/\b(XXL|XL|XS|L|M|S)\b/);
  return match ? match[1] : null;
};

const extractBudget = (text: string): number | null => {
  const normalized = normalizeText(text);
  const match = normalized.match(/\b(\d{2,5})\b/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
};

const matchesColor = (source: string, filter: string) => {
  const normalizedSource = normalizeText(source);
  const normalizedFilter = normalizeText(filter);
  if (!normalizedFilter) return true;
  return normalizedSource.includes(normalizedFilter) || normalizedFilter.includes(normalizedSource);
};

const filterLocalProducts = (
  category: ShopCategory,
  filters: { category?: string; color?: string; size?: string; budget?: number }
) => {
  const pool =
    category === 'bottomwear' ? bottomwearProducts : category === 'dupatta' ? dupattaProducts : kurtiProducts;
  return pool.filter((item) => {
    if (filters.category && item.category !== filters.category) return false;
    if (filters.color && !matchesColor(item.color, filters.color)) return false;
    if (filters.size) {
      const sizes = Array.isArray(item.sizes) ? item.sizes : [];
      if (!sizes.some((size) => size.size === filters.size)) return false;
    }
    if (filters.budget && item.price > filters.budget) return false;
    return true;
  });
};

export const ChatWidget: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const defaultCategory = React.useMemo<ShopCategory | null>(() => {
    const normalized = location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (normalized.startsWith('bottomwear')) return 'bottomwear';
    if (normalized.startsWith('dupatta')) return 'dupatta';
    return null;
  }, [location.pathname]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const [inputText, setInputText] = React.useState('');
  const [assistantContext, setAssistantContext] = React.useState<Record<string, unknown>>({});
  const [selectedCategory, setSelectedCategory] = React.useState<ShopCategory | null>(defaultCategory);
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: 1,
      sender: 'bot',
      text: getWelcomeMessage(defaultCategory),
    },
  ]);
  const quickPrompts = React.useMemo(() => {
    if (selectedCategory === 'bottomwear') {
      return ['Black pants under 999', 'Palazzo in blue', 'Office wear straight pants', 'Cotton leggings'];
    }
    if (selectedCategory === 'dupatta') {
      return ['Red dupatta under 800', 'Chiffon dupatta', 'Festive dupatta'];
    }
    return ['Blue kurti under 1000', 'Cotton kurti M', 'Office wear kurtis'];
  }, [selectedCategory]);

  const inferCategory = (text: string): ShopCategory | null => {
    const normalized = text.toLowerCase();
    if (normalized.includes('bottomwear') || normalized.includes('bottom wear') || normalized.includes('pants')) {
      return 'bottomwear';
    }
    if (normalized.includes('dupatta') || containsDupattaLike(text)) {
      return 'dupatta';
    }
    if (normalized.includes('kurti') || normalized.includes('kurtis')) {
      return 'kurti';
    }
    return null;
  };

  const appendMessage = React.useCallback((sender: Sender, text: string, links?: Recommendation[]) => {
    setMessages((previous) => [
      ...previous,
      {
        id: previous.length + 1,
        sender,
        text,
        links,
      },
    ]);
  }, []);

  const openProduct = (id: number) => {
    setIsOpen(false);
    if (selectedCategory === 'bottomwear') {
      navigate(`/bottomwear/product/${id}`);
      return;
    }
    if (selectedCategory === 'dupatta') {
      navigate(`/dupatta/product/${id}`);
      return;
    }
    navigate(`/product/${id}`);
  };

  const handleSend = async (overrideText?: string) => {
    const userText = (overrideText ?? inputText).trim();
    if (!userText || isSearching) return;

    setInputText('');
    appendMessage('user', userText);
    setIsSearching(true);
    let latestFilters: Record<string, unknown> = {};
    try {
      let activeCategory = selectedCategory;
      if (!activeCategory) {
        const inferred = inferCategory(userText);
        if (!inferred) {
          appendMessage('bot', 'Please tell me which category you want: kurti, bottomwear, or dupatta.');
          return;
        }
        activeCategory = inferred;
        setSelectedCategory(inferred);
        appendMessage(
          'bot',
          `Great! I will help you with ${inferred}. Tell me a color, size, or budget to narrow it down.`
        );
        const normalized = userText.toLowerCase();
        if (normalized === 'kurti' || normalized === 'bottomwear' || normalized === 'dupatta') {
          return;
        }
      }

      const { parsed } = buildAnalysisSummary(userText);
      const lastQuestion = (assistantContext.lastQuestion as string | undefined) ?? '';
      const structuredFilters: Record<string, unknown> = {
        ...(assistantContext.filters as object),
        category_type: activeCategory,
      };
      latestFilters = structuredFilters;
      const sizeFromText = extractSize(userText);
      const budgetFromText = parsed.filters.max_price ?? extractBudget(userText);
      const colorFromText = parsed.filters.color ?? '';
      if (sizeFromText) {
        structuredFilters.size = sizeFromText;
      }
      if (budgetFromText !== null && budgetFromText !== undefined) {
        structuredFilters.budget = budgetFromText;
      }
      if (colorFromText) {
        structuredFilters.color = colorFromText;
      }
      if (lastQuestion === 'budget' && !structuredFilters.budget && budgetFromText) {
        structuredFilters.budget = budgetFromText;
      }
      if (lastQuestion === 'size' && !structuredFilters.size && sizeFromText) {
        structuredFilters.size = sizeFromText;
      }
      if (lastQuestion === 'color' && !structuredFilters.color && colorFromText) {
        structuredFilters.color = colorFromText;
      }
      if (activeCategory === 'bottomwear') {
        const style = findMatch(userText, BOTTOMWEAR_STYLE_MAP);
        if (style) structuredFilters.category = style;
      }
      if (activeCategory === 'dupatta') {
        const style = findMatch(userText, DUPATTA_STYLE_MAP);
        if (style) structuredFilters.category = style;
      }
      if (activeCategory === 'kurti') {
        const style = findMatch(userText, KURTI_STYLE_MAP);
        if (style) structuredFilters.category = style;
      }

      const missingFields: string[] = [];
      const hasCategory = typeof structuredFilters.category === 'string' && structuredFilters.category.length > 0;
      const hasBudget = typeof structuredFilters.budget === 'number';
      const hasSize = typeof structuredFilters.size === 'string' && structuredFilters.size.length > 0;
      const hasColor = typeof structuredFilters.color === 'string' && structuredFilters.color.length > 0;
      const hasAnyFilter = hasCategory || hasBudget || hasSize || hasColor;
      if (activeCategory === 'bottomwear') {
        if (!hasCategory) missingFields.push('style');
        if (!hasColor) missingFields.push('color');
        if (!hasSize) missingFields.push('size');
        if (!hasBudget) missingFields.push('budget');
      } else if (activeCategory === 'dupatta') {
        if (!hasCategory) missingFields.push('style');
        if (!hasColor) missingFields.push('color');
        if (!hasBudget) missingFields.push('budget');
      } else if (activeCategory === 'kurti') {
        if (!hasCategory) missingFields.push('style');
        if (!hasColor) missingFields.push('color');
        if (!hasSize) missingFields.push('size');
      }

      if (missingFields.length > 0) {
        const nextMissing = missingFields[0];
        setAssistantContext((prev) => ({ ...prev, filters: structuredFilters, lastQuestion: nextMissing }));
        if (hasAnyFilter) {
          const partialMatches = filterLocalProducts(activeCategory, {
            category: structuredFilters.category as string | undefined,
            color: structuredFilters.color as string | undefined,
            size: structuredFilters.size as string | undefined,
            budget: structuredFilters.budget as number | undefined,
          }).slice(0, 4);
          const partialLinks = partialMatches.map((item) => ({
            id: item.id,
            name: item.name,
            color: item.color,
            price: item.price,
            image_url: item.image,
            category: item.category,
          }));
          if (partialLinks.length > 0) {
            appendMessage('bot', 'Here are some options based on what you shared so far:', partialLinks);
          }
        }
        if (activeCategory === 'bottomwear' && nextMissing === 'style') {
          appendMessage(
            'bot',
            'Which bottomwear style do you prefer: leggings, palazzo, straight pants, bell bottom, or wide leg?'
          );
          return;
        }
        if (activeCategory === 'dupatta' && nextMissing === 'style') {
          appendMessage('bot', 'Which dupatta style do you prefer: casual, festive, or multi colour?');
          return;
        }
        if (activeCategory === 'kurti' && nextMissing === 'style') {
          appendMessage(
            'bot',
            'Which kurti style do you prefer: anarkali, casual, chikankari, formal, short, or silk?'
          );
          return;
        }
        if (nextMissing === 'color') {
          appendMessage('bot', 'Which color do you prefer?');
          return;
        }
        if (nextMissing === 'size') {
          appendMessage('bot', 'Which size do you prefer? (XS, S, M, L, XL, XXL)');
          return;
        }
        if (nextMissing === 'budget') {
          appendMessage('bot', 'What is your budget (max price) in Rs?');
          return;
        }
        return;
      }

      setAssistantContext((prev) => ({ ...prev, filters: structuredFilters, lastQuestion: '' }));

      const response = await chatAssistant({
        message: userText,
        context: { ...assistantContext, filters: structuredFilters },
      });

      setAssistantContext(response.context || {});
      if (!selectedCategory && response.context?.filters?.category_type) {
        const nextCategory = String(response.context.filters.category_type) as ShopCategory;
        setSelectedCategory(nextCategory);
      }
      const { summary } = buildAnalysisSummary(userText);
      const summaryLine = summary.length > 0 ? `\n\nDetected filters: ${summary.join(', ')}` : '';

      const rawReply = response.reply || 'I am here to help.';
      const normalizedReply = rawReply.toLowerCase();
      const looksLikeKurtiVarieties =
        normalizedReply.includes('which variety do you prefer') &&
        (normalizedReply.includes('office wear') ||
          normalizedReply.includes('chikankari') ||
          normalizedReply.includes('casual') ||
          normalizedReply.includes('festive wear') ||
          normalizedReply.includes('cotton'));

      let finalReply = rawReply;
      if (activeCategory === 'bottomwear' && looksLikeKurtiVarieties) {
        const pickedStyle = findMatch(userText, BOTTOMWEAR_STYLE_MAP);
        finalReply = pickedStyle
          ? `Great choice! Showing ${pickedStyle.toLowerCase()} options now.`
          : 'Which bottomwear style do you prefer: leggings, palazzo, straight pants, bell bottom, or wide leg?';
      } else if (activeCategory === 'dupatta' && looksLikeKurtiVarieties) {
        const pickedStyle = findMatch(userText, DUPATTA_STYLE_MAP);
        finalReply = pickedStyle
          ? `Great choice! Showing ${pickedStyle.toLowerCase()} options now.`
          : 'Which dupatta style do you prefer: casual, festive, or multi colour?';
      }

      const links = response.links && response.links.length > 0 ? response.links : undefined;
      if (!links) {
        const localMatches = filterLocalProducts(activeCategory, {
          category: structuredFilters.category as string | undefined,
          color: structuredFilters.color as string | undefined,
          size: structuredFilters.size as string | undefined,
          budget: structuredFilters.budget as number | undefined,
        }).slice(0, 4);
        const fallbackLinks = localMatches.map((item) => ({
          id: item.id,
          name: item.name,
          color: item.color,
          price: item.price,
          image_url: item.image,
          category: item.category,
        }));
        appendMessage('bot', `${finalReply}${summaryLine}`, fallbackLinks.length > 0 ? fallbackLinks : undefined);
      } else {
        appendMessage('bot', `${finalReply}${summaryLine}`, links);
      }
    } catch {
      const fallbackCategory = selectedCategory ?? inferCategory(userText);
      const localMatches = fallbackCategory
        ? filterLocalProducts(fallbackCategory, {
            category: latestFilters.category as string | undefined,
            color: latestFilters.color as string | undefined,
            size: latestFilters.size as string | undefined,
            budget: latestFilters.budget as number | undefined,
          }).slice(0, 4)
        : [];
      if (localMatches.length > 0) {
        const fallbackLinks = localMatches.map((item) => ({
          id: item.id,
          name: item.name,
          color: item.color,
          price: item.price,
          image_url: item.image,
          category: item.category,
        }));
        appendMessage('bot', 'Here are some options I can find right now:', fallbackLinks);
      } else {
        appendMessage('bot', 'Assistant is unavailable right now. Please try again.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleVoiceSearch = () => {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionFactory;
      webkitSpeechRecognition?: SpeechRecognitionFactory;
    };
    const speechApi = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!speechApi) {
      alert('Voice search is not supported in this browser.');
      return;
    }

    const recognition = new speechApi();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = String(event.results?.[0]?.[0]?.transcript ?? '').trim();
      if (!transcript) {
        return;
      }
      setInputText(transcript);
      void handleSend(transcript);
    };
    recognition.onerror = () => {
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleRestart = () => {
    setAssistantContext({});
    setSelectedCategory(defaultCategory);
    setMessages([
      {
        id: 1,
        sender: 'bot',
        text: getWelcomeMessage(defaultCategory),
      },
    ]);
  };

  React.useEffect(() => {
    if (defaultCategory && !selectedCategory) {
      setSelectedCategory(defaultCategory);
    }
  }, [defaultCategory, selectedCategory]);

  return (
    <div className="chat-widget" aria-live="polite">
      {isOpen && (
        <div className="chat-box">
          <div className="chat-header">
            <h3>SheKurti Shopping Assistant</h3>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Close chat">
              x
            </button>
          </div>

          <div className="chat-messages">
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.sender}`}>
                <p>{message.text}</p>
                {message.links && message.links.length > 0 && (
                  <div className="chat-links">
                    {message.links.map((link) => (
                      <button
                        key={link.id}
                        type="button"
                        className="chat-link-btn"
                        onClick={() => openProduct(link.id)}
                      >
                        <div className="chat-link-body">
                          <strong>{link.name}</strong>
                          <span>{link.category || link.color}</span>
                          <em>Rs {link.price}</em>
                        </div>
                        {link.image_url ? <img src={link.image_url} alt={link.name} /> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isSearching && (
              <div className="message bot">
                <p>Finding the best matches for you...</p>
              </div>
            )}
          </div>

          <div className="chat-controls">
            <input
              type="text"
              placeholder={
                selectedCategory === 'bottomwear'
                  ? 'Ask about bottomwear, e.g. "black pants under 1000"'
                  : selectedCategory === 'dupatta'
                    ? 'Ask about dupatta, e.g. "red dupatta under 800"'
                    : selectedCategory === 'kurti'
                      ? 'Ask about kurtis, e.g. "blue kurti m size under 1000"'
                      : 'Tell me what you want, e.g. "kurti", "bottomwear", or "dupatta"'
              }
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.stopPropagation();
                  void handleSend();
                }
              }}
            />
            <button
              type="button"
              className={`chat-voice-btn ${isListening ? 'active' : ''}`}
              onClick={handleVoiceSearch}
              aria-label="Voice search"
              title={isListening ? 'Listening...' : 'Voice search'}
              disabled={isSearching}
            >
              <Mic size={16} />
            </button>
            {isListening ? <span className="chat-listening">Listening...</span> : null}
            <button type="button" onClick={() => void handleSend()} disabled={isSearching}>
              {isSearching ? 'Thinking...' : 'Send'}
            </button>
          </div>
          <div className="chat-quick-replies">
            {!selectedCategory ? (
              ['Kurti', 'Bottomwear', 'Dupatta'].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    const lower = option.toLowerCase() as ShopCategory;
                    setSelectedCategory(lower);
                    appendMessage('user', option);
                    appendMessage(
                      'bot',
                      `Great! I will help you with ${lower}. Tell me a color, size, or budget to narrow it down.`
                    );
                  }}
                >
                  {option}
                </button>
              ))
            ) : (
              quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setInputText(prompt)}
                >
                  {prompt}
                </button>
              ))
            )}
          </div>
          <div className="chat-footer-actions">
            <button type="button" className="restart-btn-inline" onClick={handleRestart}>
              Start New Chat
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className={`chat-toggle ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen((previous) => !previous)}
        aria-label="Open AI chat assistant"
      >
        Chat
      </button>
    </div>
  );
};


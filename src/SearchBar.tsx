import { useState, useRef, useCallback, useEffect } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

// Check for Web Speech API support
const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export default function SearchBar({ value, onChange, placeholder, className }: SearchBarProps) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const supportsVoice = !!SpeechRecognition;

  const stopListening = useCallback(() => {
    setListening(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
  }, []);

  const toggleListening = useCallback(() => {
    // If currently listening, stop
    if (recognitionRef.current) {
      stopListening();
      return;
    }

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      onChangeRef.current(transcript);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "aborted") {
        stopListening();
      }
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setListening(true);

    try {
      recognition.start();
    } catch {
      stopListening();
    }
  }, [stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
      }
    };
  }, []);

  return (
    <div className={`search-bar ${className || ""}`}>
      <input
        className="search-bar-input"
        placeholder={placeholder || "Search..."}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          className="search-bar-clear"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
      {supportsVoice && (
        <button
          className={`search-bar-mic ${listening ? "search-bar-mic--active" : ""}`}
          onClick={toggleListening}
          aria-label="Voice search"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="1" width="6" height="11" rx="3" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>
      )}
    </div>
  );
}

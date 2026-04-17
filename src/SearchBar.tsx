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
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingRef = useRef(false);

  const supportsVoice = !!SpeechRecognition;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const stopListening = useCallback(() => {
    setListening(false);
    isHoldingRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) { console.log("[Voice] SpeechRecognition not supported"); return; }

    // Stop any existing session
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      console.log("[Voice] Recognition started");
    };

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      console.log("[Voice] Result:", transcript);
      onChangeRef.current(transcript);
    };

    recognition.onerror = (event: any) => {
      console.log("[Voice] Error:", event.error);
      if (event.error !== "aborted") {
        stopListening();
      }
    };

    recognition.onend = () => {
      console.log("[Voice] Ended, still holding:", isHoldingRef.current);
      if (isHoldingRef.current) {
        try { recognition.start(); } catch { stopListening(); }
      } else {
        setListening(false);
        recognitionRef.current = null;
      }
    };

    recognition.onspeechstart = () => {
      console.log("[Voice] Speech detected");
    };

    recognition.onnomatch = () => {
      console.log("[Voice] No match");
    };

    recognitionRef.current = recognition;
    setListening(true);

    try {
      recognition.start();
      console.log("[Voice] Called start()");
    } catch (e) {
      console.log("[Voice] Start failed:", e);
      stopListening();
    }
  }, [stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
      }
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  const handlePointerDown = useCallback(() => {
    isHoldingRef.current = true;
    // Small delay to distinguish tap from hold
    holdTimerRef.current = setTimeout(() => {
      if (isHoldingRef.current) {
        startListening();
      }
    }, 150);
  }, [startListening]);

  const handlePointerUp = useCallback(() => {
    isHoldingRef.current = false;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    // If we were listening, stop
    if (recognitionRef.current) {
      stopListening();
    }
  }, [stopListening]);

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
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
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

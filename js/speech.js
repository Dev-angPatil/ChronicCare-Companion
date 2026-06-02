/* ----------------------------------------------------
   WEB SPEECH API VOICE DICTATION MODULE (js/speech.js)
---------------------------------------------------- */

let recognition = null;
let isListening = false;

/**
 * Checks if the browser supports Speech Recognition natively.
 */
export function isSpeechSupported() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  return !!SpeechRecognition;
}

/**
 * Initializes and starts recording audio for dictation.
 * @param {function} onResultCallback - Called when partial/final transcript is received.
 * @param {function} onEndCallback - Called when recognition stream terminates.
 * @param {function} onErrorCallback - Called on speech errors.
 */
export function startListening(onResultCallback, onEndCallback, onErrorCallback) {
  if (isListening) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Speech recognition is not supported in this browser.");
    if (onErrorCallback) onErrorCallback("Speech recognition not supported in this browser.");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false; // Capture a single sentence
  recognition.interimResults = false; // Only final result
  recognition.lang = "en-US";

  recognition.onstart = () => {
    isListening = true;
    console.log("Voice recognition started.");
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    console.log("Voice transcript received:", transcript);
    if (onResultCallback) onResultCallback(transcript);
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    isListening = false;
    if (onErrorCallback) onErrorCallback(event.error);
  };

  recognition.onend = () => {
    isListening = false;
    console.log("Voice recognition stopped.");
    if (onEndCallback) onEndCallback();
  };

  recognition.start();
}

/**
 * Stops listening and aborts the active speech recognition stream.
 */
export function stopListening() {
  if (!isListening || !recognition) return;
  recognition.stop();
  isListening = false;
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./Snackbar.module.css";

type SnackbarTone = "success" | "error";
type SnackbarAction = { label: string; onClick: () => void };
type SnackbarOptions = {
  tone?: SnackbarTone;
  action?: SnackbarAction;
  /** How long the snackbar stays visible before sliding away, in ms. */
  duration?: number;
};
type SnackbarMessage = SnackbarOptions & { id: number; text: string };
type ShowSnackbar = (text: string, options?: SnackbarOptions) => void;

const SnackbarContext = createContext<ShowSnackbar | null>(null);
const DEFAULT_DISMISS_AFTER_MS = 3000;
// Keep in sync with the slide transition duration in Snackbar.module.css.
const SLIDE_DURATION_MS = 250;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<SnackbarMessage | null>(null);
  const [visible, setVisible] = useState(false);
  const nextId = useRef(0);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const removeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const clearTimers = useCallback(() => {
    clearTimeout(dismissTimer.current);
    clearTimeout(removeTimer.current);
  }, []);

  // Slides the snackbar back down, then removes it once the animation ends.
  const dismiss = useCallback((id: number) => {
    setVisible(false);
    removeTimer.current = setTimeout(
      () => setMessage((current) => (current?.id === id ? null : current)),
      prefersReducedMotion() ? 0 : SLIDE_DURATION_MS,
    );
  }, []);

  const show = useCallback<ShowSnackbar>(
    (text, options) => {
      clearTimers();
      const id = ++nextId.current;
      setMessage({
        id,
        text,
        tone: options?.tone ?? "success",
        action: options?.action,
      });
      setVisible(false);
      // Wait a couple of frames so the hidden state paints before sliding in.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true)),
      );
      dismissTimer.current = setTimeout(
        () => dismiss(id),
        options?.duration ?? DEFAULT_DISMISS_AFTER_MS,
      );
    },
    [clearTimers, dismiss],
  );

  useEffect(() => clearTimers, [clearTimers]);

  return (
    <SnackbarContext.Provider value={show}>
      {children}
      {message && (
        <div
          className={`${styles.snackbar} ${visible ? styles.visible : ""} ${message.tone === "error" ? styles.error : ""}`}
          role="status"
          aria-live="polite"
        >
          <p>{message.text}</p>
          <div className={styles.actions}>
            {message.action && (
              <Button
                type="button"
                variant="text"
                size="sm"
                className={styles.action}
                onClick={() => {
                  message.action?.onClick();
                  clearTimers();
                  dismiss(message.id);
                }}
              >
                {message.action.label}
              </Button>
            )}
            <Button
              type="button"
              variant="text"
              size="icon-sm"
              className={styles.close}
              aria-label="Dismiss notification"
              onClick={() => {
                clearTimers();
                dismiss(message.id);
              }}
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const show = useContext(SnackbarContext);
  if (!show) throw new Error("SnackbarProvider is required");
  return show;
}

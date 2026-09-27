import debounce from "lodash/debounce";
import { householdSchema, type Household } from "@nosh/contracts";

export type HouseholdDraft = Omit<Household, "householdSize"> & {
  householdSize: string;
};
type Snapshot = {
  draft: HouseholdDraft | null;
  status: "saved" | "unsaved" | "saving" | "error";
  invalidSize: boolean;
};

// This session outlives the page. Revision checks prevent old responses from
// replacing a newer draft; only the latest debounced snapshot can be queued.
export class HouseholdAutosave {
  private snapshot: Snapshot = {
    draft: null,
    status: "saved",
    invalidSize: false,
  };
  private listeners = new Set<() => void>();
  private revision = 0;
  private inFlight = false;
  private ready = false;
  private pending: Household | null = null;

  constructor(private save: (value: Household) => Promise<Household>) {}

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit(snapshot: Snapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }

  initialize(value: Household) {
    if (this.snapshot.draft) return;
    this.emit({
      draft: { ...value, householdSize: String(value.householdSize) },
      status: "saved",
      invalidSize: false,
    });
  }

  private debounced = debounce(() => {
    this.ready = true;
    void this.drain();
  }, 600);

  edit = (draft: HouseholdDraft) => {
    this.revision++;
    this.ready = false;
    this.debounced.cancel();
    const parsed = householdSchema.safeParse({
      ...draft,
      householdSize: Number(draft.householdSize),
    });
    this.pending = parsed.success ? parsed.data : null;
    this.emit({ draft, status: "unsaved", invalidSize: !parsed.success });
    if (parsed.success) this.debounced();
  };

  retry = () => {
    if (!this.pending) return;
    this.debounced.cancel();
    this.ready = true;
    void this.drain();
  };

  private async drain() {
    if (this.inFlight || !this.ready || !this.pending) return;
    const value = this.pending;
    const revision = this.revision;
    this.ready = false;
    this.inFlight = true;
    this.emit({ ...this.snapshot, status: "saving" });

    try {
      const saved = await this.save(value);
      if (revision === this.revision) {
        this.emit({
          draft: { ...saved, householdSize: String(saved.householdSize) },
          status: "saved",
          invalidSize: false,
        });
      }
    } catch {
      this.ready = false;
      this.debounced.cancel();
      this.emit({ ...this.snapshot, status: "error" });
    } finally {
      this.inFlight = false;
    }

    if (this.ready) void this.drain();
  }

  dispose = () => {
    this.debounced.cancel();
    this.ready = false;
  };
}

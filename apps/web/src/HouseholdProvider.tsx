import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { fetchHousehold, saveHousehold } from "@/lib/api";
import { HouseholdAutosave } from "@/lib/household-autosave";
import { useSnackbar } from "@/components/Snackbar";

const HouseholdContext = createContext<ReturnType<
  typeof useHouseholdSession
> | null>(null);

function useHouseholdSession() {
  const client = useQueryClient();
  const { pathname } = useLocation();
  const showSnackbar = useSnackbar();
  const [session] = useState(
    () =>
      new HouseholdAutosave(async (value) => {
        const saved = await saveHousehold(value);
        client.setQueryData(["household"], saved);
        return saved;
      }),
  );
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const query = useQuery({
    queryKey: ["household"],
    queryFn: fetchHousehold,
    enabled: pathname === "/household" && !state.draft,
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    if (query.data) session.initialize(query.data);
  }, [query.data, session]);

  useEffect(() => () => session.dispose(), [session]);

  useEffect(() => {
    if (state.status === "saved") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.status]);

  const previousStatus = useRef(state.status);
  useEffect(() => {
    if (state.status !== previousStatus.current) {
      if (state.status === "saved" && previousStatus.current === "saving") {
        showSnackbar("Saved");
      }
      if (state.status === "error") {
        showSnackbar("Couldn’t save your household settings.", {
          tone: "error",
          action: { label: "Retry", onClick: session.retry },
        });
      }
      previousStatus.current = state.status;
    }
  }, [state.status, session, showSnackbar]);

  return {
    ...state,
    edit: session.edit,
    retry: session.retry,
    loadError: query.isError,
    reload: query.refetch,
  };
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const session = useHouseholdSession();
  return (
    <HouseholdContext.Provider value={session}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const context = useContext(HouseholdContext);
  if (!context) throw new Error("HouseholdProvider is required");
  return context;
}

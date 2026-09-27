import { useContext, useEffect } from "react";
import { UNSAFE_DataRouterContext, useBlocker } from "react-router-dom";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";

function RouteGuard({ dirty }: { dirty: boolean }) {
  const blocker = useBlocker(dirty);
  return (
    <Dialog
      open={blocker.state === "blocked"}
      onOpenChange={(open) => {
        if (!open && blocker.state === "blocked") blocker.reset();
      }}
    >
      <DialogContent>
        <DialogTitle>Discard this recipe?</DialogTitle>
        <DialogDescription>
          Your unsaved changes will be lost.
        </DialogDescription>
        <Button
          variant="secondary"
          onClick={() => {
            if (blocker.state === "blocked") blocker.reset();
          }}
        >
          Keep editing
        </Button>
        <Button
          onClick={() => {
            if (blocker.state === "blocked") blocker.proceed();
          }}
        >
          Discard recipe
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function UnsavedRecipeGuard({ dirty }: { dirty: boolean }) {
  const router = useContext(UNSAFE_DataRouterContext);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return router ? <RouteGuard dirty={dirty} /> : null;
}

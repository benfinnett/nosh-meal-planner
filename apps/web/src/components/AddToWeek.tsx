import { useNavigate } from "react-router-dom";
import { IconPlus } from "@tabler/icons-react";
import { weekSchema } from "@nosh/contracts";
import { fetchHousehold } from "@/lib/api";
import {
  fetchPlanner,
  plannerRequest,
  usePlannerWrite,
} from "@/lib/planner-api";
import { Button } from "@/components/ui/button";
import { useSnackbar } from "@/components/Snackbar";

export function AddToWeek({
  recipeId,
  showLabel,
  onAdded,
}: {
  recipeId: string;
  showLabel?: boolean;
  onAdded?: () => void;
}) {
  const navigate = useNavigate();
  const notify = useSnackbar();
  const write = usePlannerWrite();
  async function add() {
    const result = await write.run(async () => {
      const [planner, household] = await Promise.all([
        fetchPlanner(),
        fetchHousehold({}),
      ]);
      if (!planner.current) {
        navigate(`/plan?add=${encodeURIComponent(recipeId)}`);
        return null;
      }
      return plannerRequest(
        `/weeks/${planner.current.id}/meals`,
        weekSchema,
        "POST",
        {
          expectedRevision: planner.current.revision,
          recipeId,
          servings: household.householdSize,
        },
      );
    });
    if (result) {
      notify("Added to your week");
      onAdded?.();
    }
  }
  return (
    <div>
      <Button
        variant="secondary"
        aria-label="Add to week"
        disabled={write.pending}
        onClick={() => void add()}
      >
        <IconPlus aria-hidden="true" />
        {showLabel && "Add to week"}
      </Button>
      {write.error && <p role="alert">{write.error}</p>}
    </div>
  );
}

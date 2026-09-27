import { useState, type ReactNode } from "react";
import { type Week, type PlannedMeal, type ShoppingRow } from "@nosh/contracts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RecipeContent } from "./RecipeDetailPage";
import styles from "./MealPlan.module.css";
import {
  IconCopy,
  IconDeviceFloppy,
  IconEdit,
  IconTrash,
  IconX,
} from "@tabler/icons-react";

export function Modal({
  title,
  description,
  close,
  children,
}: {
  title: string;
  description: string;
  close: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className={styles.dialog}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function Coverage({ counts }: { counts: Week["coverage"] }) {
  return (
    <div>
      <ul className={styles.coverage} aria-label="Autofill coverage">
        {(["breakfast", "lunch", "dinner"] as const).map((type) => (
          <li key={type}>
            <span>{type}</span>
            <strong>
              {counts[type]} <small>/ 7</small>
            </strong>
            <progress
              value={counts[type]}
              max={7}
              aria-label={`${type} autofill coverage`}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MealCollection({
  meals,
  editable,
  busy,
  change,
  addAgain,
  remove,
}: {
  meals: PlannedMeal[];
  editable: boolean;
  busy: boolean;
  change?: (meal: PlannedMeal, servings: number) => Promise<boolean>;
  addAgain?: (meal: PlannedMeal) => void;
  remove?: (meal: PlannedMeal) => void;
}) {
  const [view, setView] = useState<PlannedMeal | null>(null);
  const [edit, setEdit] = useState<PlannedMeal | null>(null);
  const [servings, setServings] = useState("");
  const valid = Number.isSafeInteger(Number(servings)) && Number(servings) > 0;
  return (
    <>
      <div className={styles.meals}>
        {meals.map((meal, index) => (
          <article
            className={styles.meal}
            key={meal.id}
            aria-label={`${meal.snapshot.name}, selection ${index + 1}`}
          >
            <button
              className={styles.mealView}
              type="button"
              aria-label={`View recipe ${meal.snapshot.name}`}
              onClick={() => setView(meal)}
            />
            <p className={styles.eyebrow}>
              {meal.snapshot.mealType.join(" · ") || "Other meal"}
            </p>
            <h2>{meal.snapshot.name}</h2>
            <p>
              For {meal.servings} {meal.servings === 1 ? "person" : "people"}
            </p>
            <div className={styles.actions}>
              {editable && (
                <>
                  <Button
                    variant="text"
                    disabled={busy}
                    onClick={() => {
                      setEdit(meal);
                      setServings(String(meal.servings));
                    }}
                  >
                    <IconEdit aria-hidden="true" />
                    Change servings
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => addAgain?.(meal)}
                  >
                    <IconCopy aria-hidden="true" />
                    Add again
                  </Button>
                  <Button
                    variant="text-error"
                    disabled={busy}
                    onClick={() => remove?.(meal)}
                  >
                    <IconTrash aria-hidden="true" />
                    Remove
                  </Button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
      {view && (
        <Modal
          title="Your captured recipe"
          description="This copy stays with your meal collection."
          close={() => setView(null)}
        >
          <RecipeContent
            recipe={view.snapshot}
            initialServings={view.servings}
            captured
          />
        </Modal>
      )}
      {edit && (
        <Modal
          title="Change servings"
          description={edit.snapshot.name}
          close={() => {
            if (!busy) setEdit(null);
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (valid)
                void change?.(edit, Number(servings)).then((saved) => {
                  if (saved) setEdit(null);
                });
            }}
          >
            <div className={styles.field}>
              <label htmlFor="meal-servings">Servings</label>
              <div className={styles.servingsStepper}>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="text-lg"
                  aria-label="Decrease servings"
                  disabled={busy || !valid || Number(servings) <= 1}
                  onClick={() => setServings(String(Number(servings) - 1))}
                >
                  −
                </Button>
                <input
                  id="meal-servings"
                  type="number"
                  min="1"
                  step="1"
                  max={Number.MAX_SAFE_INTEGER}
                  value={servings}
                  disabled={busy}
                  onChange={(event) => setServings(event.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="text-lg"
                  aria-label="Increase servings"
                  disabled={
                    busy ||
                    !valid ||
                    Number(servings) >= Number.MAX_SAFE_INTEGER
                  }
                  onClick={() => setServings(String(Number(servings) + 1))}
                >
                  +
                </Button>
              </div>
            </div>
            {!valid && <p>Enter a positive whole number.</p>}
            <div className={styles.actions}>
              <Button type="submit" disabled={!valid || busy}>
                <IconDeviceFloppy aria-hidden="true" />
                Save servings
              </Button>
              <Button
                variant="text"
                disabled={busy}
                onClick={() => setEdit(null)}
              >
                <IconX aria-hidden="true" />
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export function Shopping({
  week,
  busy,
  toggle,
}: {
  week: Week;
  busy: boolean;
  toggle: (row: ShoppingRow, checked: boolean) => void;
}) {
  return (
    <section aria-label="Shopping list">
      <h2>Your shopping list</h2>
      {!week.shopping.length && (
        <p>Add meals to begin building your shopping list.</p>
      )}
      <ul className={styles.shopping}>
        {week.shopping.map((row) => (
          <li
            key={row.key}
            className={row.checked ? styles.checked : undefined}
          >
            <label className={styles.shopLabel}>
              <input
                type="checkbox"
                aria-label={`I have this: ${row.label}`}
                checked={row.checked}
                disabled={busy || week.status === "archived"}
                onChange={(event) => toggle(row, event.target.checked)}
              />
              <span>
                <strong>{row.label}</strong>
                <span className={styles.quantity}>
                  {row.components
                    .map(
                      (c) =>
                        `${c.display}${c.suggested !== null ? ` · Get ${c.suggested}${c.unit ? ` ${c.unit}` : ""}` : ""}`,
                    )
                    .join(" + ")}
                </span>
                {row.review && (
                  <span className={styles.review}>
                    Quantity changed — check again
                  </span>
                )}
              </span>
            </label>
            <details className={styles.attribution}>
              <summary>
                Used in{" "}
                {new Set(row.attribution.map((a) => a.occurrenceId)).size} meals
              </summary>
              <ul>
                {row.attribution.map((a) => (
                  <li key={`${a.occurrenceId}-${a.position}`}>
                    {a.recipeName} · {a.servings} servings
                    {a.prep ? ` · ${a.prep}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

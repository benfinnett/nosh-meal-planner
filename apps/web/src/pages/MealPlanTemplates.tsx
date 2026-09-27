import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { templateSchema, type MealTemplate } from "@nosh/contracts";
import { plannerRequest, usePlannerWrite } from "@/lib/planner-api";
import { Button } from "@/components/ui/button";
import { MealCollection, Modal } from "./MealPlanComponents";
import styles from "./MealPlan.module.css";
import {
  IconCalendarPlus,
  IconDeviceFloppy,
  IconEdit,
  IconTrash,
  IconX,
} from "@tabler/icons-react";

export function MealPlanTemplates({
  templates,
}: {
  templates: MealTemplate[];
}) {
  const [view, setView] = useState<MealTemplate | null>(null);
  const [edit, setEdit] = useState<MealTemplate | null>(null);
  const [remove, setRemove] = useState<MealTemplate | null>(null);
  const [name, setName] = useState("");
  const write = usePlannerWrite();
  const navigate = useNavigate();
  return (
    <section>
      <h1>Templates</h1>
      <p>Save a week’s meals as a template to see it here.</p>
      <div className={styles.meals}>
        {templates.map((t) => (
          <article className={styles.meal} key={t.id}>
            <button
              className={styles.mealView}
              type="button"
              aria-label={`View template ${t.name}`}
              onClick={() => setView(t)}
            />
            <div className={styles.templateTitle}>
              <h2>{t.name}</h2>
              <Button
                variant="text"
                size="icon-sm"
                aria-label={`Rename ${t.name}`}
                title="Rename template"
                disabled={write.pending}
                onClick={() => {
                  setEdit(t);
                  setName(t.name);
                }}
              >
                <IconEdit aria-hidden="true" />
              </Button>
            </div>
            <p>{t.meals.length} meals</p>
            <div className={styles.actions}>
              <Button
                onClick={() => {
                  navigate(
                    `/plan?start=1&template=${encodeURIComponent(t.id)}`,
                  );
                }}
              >
                <IconCalendarPlus aria-hidden="true" />
                Use for a new week
              </Button>
              <Button
                variant="text-error"
                disabled={write.pending}
                onClick={() => setRemove(t)}
              >
                <IconTrash aria-hidden="true" />
                Delete
              </Button>
            </div>
          </article>
        ))}
      </div>
      {write.error && <p role="alert">{write.error}</p>}
      {view && (
        <Modal
          title={view.name}
          description="A reusable collection, without dates or shopping checks."
          close={() => setView(null)}
        >
          <MealCollection meals={view.meals} editable={false} busy={false} />
        </Modal>
      )}
      {edit && (
        <Modal
          title="Rename template"
          description="Weeks copied from this template will stay unchanged."
          close={() => {
            if (!write.pending) setEdit(null);
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void write
                .run(() =>
                  plannerRequest(
                    `/templates/${edit.id}`,
                    templateSchema,
                    "PATCH",
                    { expectedRevision: edit.revision, name: name.trim() },
                  ),
                )
                .then((result) => {
                  if (result) setEdit(null);
                });
            }}
          >
            <label className={styles.field}>
              Template name
              <input
                required
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            {write.error && <p role="alert">{write.error}</p>}
            <Button type="submit" disabled={write.pending || !name.trim()}>
              <IconDeviceFloppy aria-hidden="true" />
              Save name
            </Button>
          </form>
        </Modal>
      )}
      {remove && (
        <Modal
          title="Delete template?"
          description={`Delete “${remove.name}”? Existing weeks will be kept.`}
          close={() => {
            if (!write.pending) setRemove(null);
          }}
        >
          {write.error && <p role="alert">{write.error}</p>}
          <div className={styles.actions}>
            <Button
              variant="error"
              disabled={write.pending}
              onClick={() =>
                void write
                  .run(() =>
                    plannerRequest(
                      `/templates/${remove.id}`,
                      z.object({ deleted: z.boolean() }),
                      "DELETE",
                      { expectedRevision: remove.revision },
                    ),
                  )
                  .then((result) => {
                    if (result) setRemove(null);
                  })
              }
            >
              <IconTrash aria-hidden="true" />
              Delete template
            </Button>
            <Button
              variant="text"
              disabled={write.pending}
              onClick={() => setRemove(null)}
            >
              <IconX aria-hidden="true" />
              Cancel
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}

import { useState } from "react";
import {
  Link,
  NavLink,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  weekSchema,
  templateSchema,
  type Week,
  type MealTemplate,
  type AutofillPreview,
  type StartWeek,
} from "@nosh/contracts";
import { fetchHousehold } from "@/lib/api";
import {
  fetchPlanner,
  fetchWeek,
  fetchHistory,
  fetchTemplates,
  plannerRequest,
  previewAutofill,
  usePlannerWrite,
} from "@/lib/planner-api";
import { Button } from "@/components/ui/button";
import { AddToWeek } from "@/components/AddToWeek";
import { useSnackbar } from "@/components/Snackbar";
import {
  Coverage,
  MealCollection,
  Modal,
  Shopping,
} from "./MealPlanComponents";
import { MealPlanTemplates } from "./MealPlanTemplates";
import styles from "./MealPlan.module.css";
import {
  IconArrowRight,
  IconCalendarPlus,
  IconChefHat,
  IconChevronLeft,
  IconChevronRight,
  IconDeviceFloppy,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShoppingCart,
  IconWand,
  IconX,
} from "@tabler/icons-react";

function range(week: { weekStart: string; weekEnd: string }) {
  const format = (date: string) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${date}T12:00:00Z`));
  return `${format(week.weekStart)} – ${format(week.weekEnd)}`;
}

function StartDialog({
  current,
  suggested,
  templates,
  initialSource,
  close,
  started,
}: {
  current: Week | null;
  suggested: string;
  templates: MealTemplate[];
  initialSource?: { kind: "week" | "template"; id: string };
  close: () => void;
  started: (week: Week) => void;
}) {
  const [date, setDate] = useState(suggested);
  const [kind, setKind] = useState<"empty" | "week" | "template">(
    initialSource?.kind ?? "empty",
  );
  const [sourceId, setSourceId] = useState(initialSource?.id ?? "");
  const [policy, setPolicy] = useState<"preserve" | "household">("preserve");
  const [offset, setOffset] = useState(0);
  const history = useQuery({
    queryKey: ["planner", "history", offset],
    queryFn: () => fetchHistory(offset),
  });
  const selectedWeek = useQuery({
    queryKey: ["planner", "week", sourceId],
    queryFn: () => fetchWeek(sourceId),
    enabled: kind === "week" && !!sourceId,
  });
  const write = usePlannerWrite();
  const from =
    kind === "template"
      ? templates.find((t) => t.id === sourceId)
      : selectedWeek.data;
  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    new Date(`${date}T12:00:00Z`).getUTCDay() === 1;
  async function submit() {
    const input: Omit<StartWeek, "operationId"> = {
      weekStart: date,
      current: current ? { id: current.id, revision: current.revision } : null,
      servingsPolicy: policy,
    };
    if (kind !== "empty" && from)
      input.source = { kind, id: from.id, revision: from.revision };
    const result = await write.run(() =>
      plannerRequest("/weeks", weekSchema, "POST", input),
    );
    if (result) started(result);
  }
  return (
    <Modal
      title="Start a week"
      description="Choose the dates and a starting collection. You can change meals afterwards."
      close={() => {
        if (!write.pending) close();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className={styles.field}>
          Week beginning
          <input
            type="date"
            value={date}
            min={suggested}
            required
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        {!validDate && <p>Choose a Monday.</p>}
        <label className={styles.field}>
          Starting point
          <select
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as typeof kind);
              setSourceId("");
            }}
          >
            <option value="empty">Start empty</option>
            <option value="template">Use a template</option>
            <option value="week">Copy a previous week</option>
          </select>
        </label>
        {kind === "template" && (
          <label className={styles.field}>
            Template
            <select
              value={sourceId}
              required
              onChange={(event) => setSourceId(event.target.value)}
            >
              <option value="">Choose a template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.meals.length} meals
                </option>
              ))}
            </select>
          </label>
        )}
        {kind === "week" && (
          <>
            <label className={styles.field}>
              Previous week
              <select
                value={sourceId}
                required
                onChange={(event) => setSourceId(event.target.value)}
              >
                <option value="">Choose a week</option>
                {current && (
                  <option value={current.id}>{range(current)} · current</option>
                )}
                {history.data?.weeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {range(w)}
                  </option>
                ))}
                {selectedWeek.data &&
                  selectedWeek.data.id !== current?.id &&
                  !history.data?.weeks.some((w) => w.id === sourceId) && (
                    <option value={sourceId}>{range(selectedWeek.data)}</option>
                  )}
              </select>
            </label>
            <div className={styles.actions}>
              {offset > 0 && (
                <Button
                  variant="text"
                  onClick={() => setOffset(Math.max(0, offset - 20))}
                >
                  <IconChevronLeft aria-hidden="true" />
                  Newer weeks
                </Button>
              )}
              {history.data?.nextOffset !== null &&
                history.data?.nextOffset !== undefined && (
                  <Button
                    variant="text"
                    onClick={() => setOffset(history.data!.nextOffset!)}
                  >
                    <IconChevronRight aria-hidden="true" />
                    Older weeks
                  </Button>
                )}
            </div>
            {(history.isError || selectedWeek.isError) && (
              <p role="alert">
                Couldn’t load weeks.{" "}
                <Button
                  variant="text"
                  onClick={() => {
                    void history.refetch();
                    if (sourceId) void selectedWeek.refetch();
                  }}
                >
                  <IconRefresh aria-hidden="true" />
                  Try again
                </Button>
              </p>
            )}
          </>
        )}
        {kind !== "empty" && (
          <label className={styles.field}>
            Servings
            <select
              value={policy}
              onChange={(event) =>
                setPolicy(event.target.value as typeof policy)
              }
            >
              <option value="preserve">Keep saved servings</option>
              <option value="household">Use household servings</option>
            </select>
          </label>
        )}
        {current && (
          <p className={styles.notice}>
            Starting this week archives {range(current)} and its shopping list
            as read-only history.
          </p>
        )}
        {write.error && <p role="alert">{write.error}</p>}
        <div className={styles.actions}>
          <Button
            type="submit"
            disabled={
              write.pending || !validDate || (kind !== "empty" && !from)
            }
          >
            <IconCalendarPlus aria-hidden="true" />
            Start this week
          </Button>
          <Button variant="text" disabled={write.pending} onClick={close}>
            <IconX aria-hidden="true" />
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SaveTemplateDialog({
  week,
  templates,
  close,
}: {
  week: Week;
  templates: MealTemplate[];
  close: () => void;
}) {
  const [name, setName] = useState("");
  const [update, setUpdate] = useState(false);
  const write = usePlannerWrite();
  const notify = useSnackbar();
  const existing = templates.find(
    (t) => t.name.toLowerCase() === name.trim().toLowerCase(),
  );
  async function save() {
    const result = await write.run(() =>
      plannerRequest("/templates", templateSchema, "POST", {
        name: name.trim(),
        source: { id: week.id, revision: week.revision },
        ...(existing && update
          ? { target: { id: existing.id, revision: existing.revision } }
          : {}),
      }),
    );
    if (result) {
      notify("Template saved");
      close();
    }
  }
  return (
    <Modal
      title="Save as template"
      description="Keep these meals and servings as a reusable starting point."
      close={() => {
        if (!write.pending) close();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label className={styles.field}>
          Template name
          <input
            maxLength={100}
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setUpdate(false);
            }}
          />
        </label>
        {existing && (
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={update}
              onChange={(event) => setUpdate(event.target.checked)}
            />
            Update existing “{existing.name}”, or choose another name.
          </label>
        )}
        {write.error && <p role="alert">{write.error}</p>}
        <div className={styles.actions}>
          <Button
            type="submit"
            disabled={write.pending || !name.trim() || (!!existing && !update)}
          >
            <IconDeviceFloppy aria-hidden="true" />
            Save template
          </Button>
          <Button variant="text" disabled={write.pending} onClick={close}>
            <IconX aria-hidden="true" />
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function MealPlanPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<"meals" | "shopping">("meals");
  const [start, setStart] = useState(false);
  const [save, setSave] = useState(false);
  const [preview, setPreview] = useState<AutofillPreview | null>(null);
  const [offset, setOffset] = useState(0);
  const write = usePlannerWrite();
  const notify = useSnackbar();
  const overview = useQuery({
    queryKey: ["planner", "overview"],
    queryFn: fetchPlanner,
  });
  const templates = useQuery({
    queryKey: ["planner", "templates"],
    queryFn: fetchTemplates,
  });
  const household = useQuery({
    queryKey: ["household"],
    queryFn: fetchHousehold,
  });
  const historyMode = location.pathname === "/plan/history";
  const templatesMode = location.pathname === "/plan/templates";
  const weekId = location.pathname.startsWith("/plan/weeks/")
    ? location.pathname.split("/").at(-1)!
    : "";
  const savedWeek = useQuery({
    queryKey: ["planner", "week", weekId],
    queryFn: () => fetchWeek(weekId),
    enabled: !!weekId,
  });
  const history = useQuery({
    queryKey: ["planner", "history", offset],
    queryFn: () => fetchHistory(offset),
    enabled: historyMode,
  });
  const week = weekId ? savedWeek.data : overview.data?.current;
  const editable = week?.status === "active";
  const initialSource = params.has("template")
    ? { kind: "template" as const, id: params.get("template")! }
    : params.has("week")
      ? { kind: "week" as const, id: params.get("week")! }
      : undefined;
  const showStart =
    start ||
    params.has("start") ||
    (!!params.get("add") && overview.data?.current === null);

  function closeStart() {
    setStart(false);
    const next = new URLSearchParams(params);
    ["start", "template", "week", "add"].forEach((key) => next.delete(key));
    setParams(next, { replace: true });
  }
  async function mealWrite(path: string, method: string, extra: object = {}) {
    if (!week) return false;
    const result = await write.run(() =>
      plannerRequest(`/weeks/${week.id}${path}`, weekSchema, method, {
        expectedRevision: week.revision,
        ...extra,
      }),
    );
    if (result) notify("Plan updated");
    return !!result;
  }
  async function suggest() {
    if (!week) return;
    const result = await write.run(() =>
      previewAutofill(week.id, week.revision),
    );
    if (result) setPreview(result);
  }

  return (
    <section className={styles.page} aria-label="Meal planner">
      <nav className={styles.nav} aria-label="Meal plan navigation">
        <NavLink to="/plan" end>
          Current week
        </NavLink>
        <NavLink to="/plan/history" end>
          History
        </NavLink>
        <NavLink to="/plan/templates" end>
          Templates
        </NavLink>
      </nav>
      {overview.isPending && <p role="status">Loading meal plan…</p>}
      {overview.isError && (
        <p role="alert">
          Couldn’t load your meal plan.{" "}
          <Button onClick={() => void overview.refetch()}>
            <IconRefresh aria-hidden="true" />
            Try again
          </Button>
        </p>
      )}
      {write.pending && <p role="status">Saving…</p>}
      {write.error && (
        <p role="alert" className={styles.notice}>
          {write.error}
        </p>
      )}
      {templates.isError && (
        <p role="alert">
          Couldn’t load templates.{" "}
          <Button variant="text" onClick={() => void templates.refetch()}>
            <IconRefresh aria-hidden="true" />
            Retry templates
          </Button>
        </p>
      )}

      {historyMode ? (
        <section>
          <h1>Previous weeks</h1>
          <p>Your meals and shopping lists, kept as you left them.</p>
          {history.isPending && <p role="status">Loading history…</p>}
          {history.isError && (
            <p role="alert">
              Couldn’t load history.{" "}
              <Button onClick={() => void history.refetch()}>
                <IconRefresh aria-hidden="true" />
                Try again
              </Button>
            </p>
          )}
          {history.data?.weeks.length === 0 && (
            <p>
              When you start another week, your previous plan will appear here.
            </p>
          )}
          <ul className={styles.history}>
            {history.data?.weeks.map((w) => (
              <li key={w.id}>
                <div>
                  <h2>{range(w)}</h2>
                  <p>{w.mealCount} meals</p>
                </div>
                <Button
                  variant="text"
                  nativeButton={false}
                  render={<Link to={`/plan/weeks/${w.id}`} />}
                >
                  View
                  <IconArrowRight size={18} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            {offset > 0 && (
              <Button
                variant="secondary"
                onClick={() => setOffset(Math.max(0, offset - 20))}
              >
                <IconChevronLeft aria-hidden="true" />
                Newer weeks
              </Button>
            )}
            {history.data?.nextOffset !== null &&
              history.data?.nextOffset !== undefined && (
                <Button
                  variant="secondary"
                  onClick={() => setOffset(history.data!.nextOffset!)}
                >
                  <IconChevronRight aria-hidden="true" />
                  Older weeks
                </Button>
              )}
          </div>
        </section>
      ) : templatesMode ? (
        <MealPlanTemplates templates={templates.data?.templates ?? []} />
      ) : (
        <>
          {weekId && savedWeek.isPending && <p role="status">Loading week…</p>}
          {weekId && savedWeek.isError && (
            <p role="alert">
              Couldn’t load this week.{" "}
              <Button onClick={() => void savedWeek.refetch()}>
                <IconRefresh aria-hidden="true" />
                Try again
              </Button>
            </p>
          )}
          {week ? (
            <>
              <header className={styles.heading}>
                <div>
                  <p className={styles.eyebrow}>
                    {editable ? "Your active week" : "Archived · Read-only"}
                  </p>
                  <h1>{range(week)}</h1>
                  <p>{week.meals.length} meals selected</p>
                </div>
                <div className={styles.actions}>
                  {editable ? (
                    <Button
                      variant="secondary"
                      disabled={write.pending}
                      onClick={() => setStart(true)}
                    >
                      <IconPlus size={16} />
                      Start a new week
                    </Button>
                  ) : (
                    <Button
                      onClick={() => navigate(`/plan?start=1&week=${week.id}`)}
                    >
                      <IconCalendarPlus aria-hidden="true" />
                      Use for a new week
                    </Button>
                  )}
                  <Button
                    variant="text"
                    disabled={write.pending || !templates.data}
                    onClick={() => setSave(true)}
                  >
                    <IconDeviceFloppy size={16} />
                    Save as template
                  </Button>
                </div>
              </header>
              {params.get("add") && editable && (
                <div className={styles.notice}>
                  <p>Add the recipe you selected to this week.</p>
                  <AddToWeek
                    recipeId={params.get("add")!}
                    onAdded={() => setParams({})}
                  />
                </div>
              )}
              <div className={styles.tabs} aria-label="Week sections">
                <Button
                  variant={tab === "meals" ? "primary" : "text"}
                  aria-pressed={tab === "meals"}
                  onClick={() => setTab("meals")}
                >
                  <IconChefHat aria-hidden="true" />
                  Meals
                </Button>
                <Button
                  variant={tab === "shopping" ? "primary" : "text"}
                  aria-pressed={tab === "shopping"}
                  onClick={() => setTab("shopping")}
                >
                  <IconShoppingCart aria-hidden="true" />
                  Shopping
                </Button>
              </div>
              {tab === "shopping" ? (
                <Shopping
                  week={week}
                  busy={write.pending}
                  toggle={(row, checked) => {
                    void mealWrite("/shopping", "PUT", {
                      key: row.key,
                      fingerprint: row.fingerprint,
                      checked,
                    });
                  }}
                />
              ) : (
                <>
                  <Coverage counts={week.coverage} />
                  {household.data &&
                    week.meals.some(
                      (m) =>
                        !household.data.dietaryPreferences.every((p) =>
                          m.snapshot.dietary.includes(p),
                        ),
                    ) && (
                      <p className={styles.notice}>
                        Some selected meals don’t match your current dietary
                        preferences. Your selections have been kept; autofill
                        will follow your preferences.
                      </p>
                    )}
                  {editable && (
                    <div className={styles.toolbar}>
                      <Button
                        nativeButton={false}
                        render={<Link to="/recipes?picker=week" />}
                      >
                        <IconSearch aria-hidden="true" />
                        Browse recipes
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={
                          write.pending ||
                          Object.values(week.coverage).every(
                            (count) => count === 7,
                          )
                        }
                        onClick={() => void suggest()}
                      >
                        <IconWand aria-hidden="true" />
                        Smart-Fill Remaining Meals
                      </Button>
                    </div>
                  )}
                  {!week.meals.length && (
                    <div className={styles.empty}>
                      <h2>What would you like to cook?</h2>
                      <p>
                        Choose a few favourites, then let autofill suggest the
                        rest. You can add the same recipe more than once.
                      </p>
                    </div>
                  )}
                  <MealCollection
                    meals={week.meals}
                    editable={!!editable}
                    busy={write.pending}
                    change={(meal, servings) =>
                      mealWrite(`/meals/${meal.id}`, "PATCH", { servings })
                    }
                    addAgain={(meal) => {
                      void mealWrite("/meals", "POST", {
                        copyOccurrenceId: meal.id,
                        servings: meal.servings,
                      });
                    }}
                    remove={(meal) => {
                      void mealWrite(`/meals/${meal.id}`, "DELETE");
                    }}
                  />
                </>
              )}
            </>
          ) : (
            !weekId &&
            overview.data && (
              <div className={styles.empty}>
                <p className={styles.eyebrow}>A week of good food</p>
                <h1>Plan your week</h1>
                <p>
                  Collect the meals you want to make. We’ll bring the
                  ingredients together in one shopping list.
                </p>
                <Button onClick={() => setStart(true)}>
                  <IconCalendarPlus aria-hidden="true" />
                  Start a week
                </Button>
              </div>
            )
          )}
        </>
      )}
      {showStart && overview.data && templates.data && (
        <StartDialog
          current={overview.data.current}
          suggested={overview.data.suggestedWeekStart}
          templates={templates.data.templates}
          initialSource={initialSource}
          close={closeStart}
          started={() => {
            setStart(false);
            setTab("meals");
            navigate(
              params.get("add")
                ? `/plan?add=${encodeURIComponent(params.get("add")!)}`
                : "/plan",
            );
            notify("Your week is ready");
          }}
        />
      )}
      {save && week && templates.data && (
        <SaveTemplateDialog
          week={week}
          templates={templates.data.templates}
          close={() => setSave(false)}
        />
      )}
      {preview && week && (
        <Modal
          title="A mix for your week"
          description="These suggestions add to your selections. Nothing already chosen will change."
          close={() => {
            if (!write.pending) setPreview(null);
          }}
        >
          <Coverage counts={preview.coverage} />
          <ul className={styles.preview}>
            {preview.additions.map((m) => (
              <li key={m.id}>
                {m.snapshot.name}
                <span>{m.servings} servings</span>
              </li>
            ))}
          </ul>
          {Object.entries(preview.coverage)
            .filter(([, count]) => count < 7)
            .map(([type, count]) => (
              <p key={type}>
                Still need {7 - count} {type} meals: no eligible recipes can
                fill this gap. Add recipes or review your household preferences.
              </p>
            ))}
          <p className={styles.muted}>
            Favours shared ingredients and whole-item quantities. No supermarket
            pack sizes or pantry stock are assumed.
          </p>
          {write.error && <p role="alert">{write.error}</p>}
          <div className={styles.actions}>
            <Button
              disabled={write.pending || !preview.additions.length}
              onClick={() =>
                void mealWrite("/autofill/apply", "POST", {
                  token: preview.token,
                }).then((saved) => {
                  if (saved) setPreview(null);
                })
              }
            >
              <IconPlus aria-hidden="true" />
              Add these meals
            </Button>
            <Button
              variant="secondary"
              disabled={write.pending}
              onClick={() => void suggest()}
            >
              <IconRefresh aria-hidden="true" />
              Try another mix
            </Button>
            <Button
              variant="text"
              disabled={write.pending}
              onClick={() => setPreview(null)}
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

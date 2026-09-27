import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRecipeSchema,
  dietaryPreferences,
  mealTypes,
} from "@nosh/contracts";
import { createRecipe, fetchHousehold, fetchRecipeOptions } from "@/lib/api";
import { label } from "@/lib/recipe-navigation";
import { Button } from "@/components/ui/button";
import { UnsavedRecipeGuard } from "@/components/UnsavedRecipeGuard";
import styles from "./Recipes.module.css";
import {
  IconArrowDown,
  IconArrowLeft,
  IconArrowUp,
  IconCarrot,
  IconPlus,
  IconTag,
  IconTrash,
  IconX,
} from "@tabler/icons-react";

let rowId = 0;
function ingredientRow() {
  return { key: ++rowId, item: "", quantity: "", unit: "", prep: "" };
}
function stepRow() {
  return { key: ++rowId, text: "" };
}
function move<T>(rows: T[], index: number, direction: number) {
  const result = [...rows];
  [result[index], result[index + direction]] = [
    result[index + direction],
    result[index],
  ];
  return result;
}

export default function CreateRecipePage() {
  const household = useQuery({
    queryKey: ["household"],
    queryFn: fetchHousehold,
    staleTime: Infinity,
  });
  const options = useQuery({
    queryKey: ["recipe-filter-options"],
    queryFn: fetchRecipeOptions,
  });
  const [name, setName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [serves, setServes] = useState<string | null>(null);
  const [meals, setMeals] = useState<string[]>([]);
  const [dietary, setDietary] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [ingredients, setIngredients] = useState(() => [ingredientRow()]);
  const [method, setMethod] = useState(() => [stepRow()]);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const form = useRef<HTMLFormElement>(null);
  const client = useQueryClient();
  const navigate = useNavigate();
  const mutation = useMutation({ mutationFn: createRecipe });

  useEffect(() => {
    if (!mutation.isSuccess) return;
    client.setQueryData(["recipe-detail", mutation.data.id], mutation.data);
    void client.invalidateQueries({ queryKey: ["recipe-catalogue"] });
    void client.invalidateQueries({ queryKey: ["recipe-filter-options"] });
    navigate(`/recipes/${mutation.data.id}`, { replace: true });
  }, [mutation.isSuccess, mutation.data, client, navigate]);

  function error(path: string) {
    return errors[path] ? (
      <span id={`error-${path}`} className={styles.error}>
        {errors[path]}
      </span>
    ) : null;
  }
  function fieldProps(path: string) {
    const [group, index, field] = path.split(".");
    const fieldLabel =
      group === "ingredients"
        ? `${field === "item" ? "Ingredient" : field === "prep" ? "Preparation" : label(field)} ${Number(index) + 1}`
        : group === "method" && index !== undefined
          ? `Step ${Number(index) + 1}`
          : (
              {
                name: "Recipe name",
                serves: "Servings",
                cuisine: "Cuisine (optional)",
                tags: "Tags (optional)",
              } as Record<string, string>
            )[path];
    return {
      "aria-label": fieldLabel,
      "aria-invalid": !!errors[path],
      "aria-describedby": errors[path] ? `error-${path}` : undefined,
    };
  }
  function addTag() {
    if (!tagInput.trim()) return;
    setTags([...new Set([...tags, tagInput.trim().toLowerCase()])]);
    setTagInput("");
    setDirty(true);
  }
  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (mutation.isPending) return;
    const result = createRecipeSchema.safeParse({
      name,
      cuisine,
      serves: Number(serves ?? household.data?.householdSize ?? 1),
      mealType: meals,
      dietary,
      tags: [
        ...new Set([
          ...tags,
          ...(tagInput.trim() ? [tagInput.trim().toLowerCase()] : []),
        ]),
      ],
      ingredients: ingredients.map((entry) => ({
        item: entry.item,
        quantity: entry.quantity.trim() === "" ? null : Number(entry.quantity),
        unit: entry.unit.trim() || null,
        prep: entry.prep.trim() || null,
      })),
      method: method.map((entry) => entry.text),
    });
    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [
            issue.path.join("."),
            issue.message,
          ]),
        ),
      );
      requestAnimationFrame(() =>
        form.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus(),
      );
      return;
    }
    setErrors({});
    mutation.mutate(result.data);
  }

  return (
    <section className={styles.page}>
      <UnsavedRecipeGuard dirty={dirty && !mutation.isSuccess} />
      <Button variant="text" render={<Link to="/recipes" />}>
        <IconArrowLeft size={18} aria-hidden="true" />
        Recipes
      </Button>
      <h1>Create recipe</h1>
      <p>Add a recipe that works for your kitchen.</p>
      <form
        ref={form}
        onSubmit={submit}
        noValidate
        onChange={() => setDirty(true)}
        className={styles.recipeForm}
      >
        <fieldset disabled={mutation.isPending || mutation.isSuccess}>
          <legend>Recipe information</legend>
          <label className={styles.field}>
            Recipe name
            <input
              value={name}
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
              {...fieldProps("name")}
            />
            {error("name")}
          </label>
          <div className={styles.formColumns}>
            <label className={styles.field}>
              Cuisine (optional)
              <input
                list="recipe-cuisines"
                value={cuisine}
                maxLength={100}
                onChange={(event) => setCuisine(event.target.value)}
                {...fieldProps("cuisine")}
              />
              {error("cuisine")}
            </label>
            <datalist id="recipe-cuisines">
              {options.data?.cuisines.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <label className={styles.field}>
              Servings
              <input
                type="number"
                min="1"
                step="1"
                value={serves ?? household.data?.householdSize ?? 1}
                onChange={(event) => setServes(event.target.value)}
                {...fieldProps("serves")}
              />
              {error("serves")}
            </label>
          </div>
          <fieldset className={styles.inlineChoices}>
            <legend>Meal types</legend>
            {mealTypes.map((value) => (
              <label key={value} className={styles.check}>
                <input
                  type="checkbox"
                  checked={meals.includes(value)}
                  onChange={(event) =>
                    setMeals(
                      event.target.checked
                        ? [...meals, value]
                        : meals.filter((entry) => entry !== value),
                    )
                  }
                  {...fieldProps("mealType")}
                />
                {label(value)}
              </label>
            ))}
            {error("mealType")}
          </fieldset>
          <fieldset className={styles.inlineChoices}>
            <legend>Dietary labels (optional)</legend>
            {dietaryPreferences.map((value) => (
              <label key={value} className={styles.check}>
                <input
                  type="checkbox"
                  checked={dietary.includes(value)}
                  onChange={(event) =>
                    setDietary(
                      event.target.checked
                        ? [...dietary, value]
                        : dietary.filter((entry) => entry !== value),
                    )
                  }
                />
                {label(value)}
              </label>
            ))}
          </fieldset>
          <p className={styles.hint}>
            Choose only labels that apply to this recipe.
          </p>
          <div className={`${styles.actions} ${styles.tagActions}`}>
            <label className={styles.field}>
              Tags (optional)
              <input
                list="recipe-tags"
                value={tagInput}
                maxLength={100}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTag();
                  }
                }}
                {...fieldProps("tags")}
              />
              {error("tags")}
            </label>
            <Button type="button" variant="secondary" onClick={addTag}>
              <IconTag aria-hidden="true" />
              Add tag
            </Button>
          </div>
          <datalist id="recipe-tags">
            {options.data?.tags.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
          <div className={styles.actions}>
            {tags.map((tag) => (
              <Button
                type="button"
                variant="secondary"
                key={tag}
                aria-label={`Remove ${label(tag)} tag`}
                onClick={() => {
                  setTags(tags.filter((entry) => entry !== tag));
                  setDirty(true);
                }}
              >
                {label(tag)}
                <IconX aria-hidden="true" />
              </Button>
            ))}
          </div>
        </fieldset>
        <fieldset disabled={mutation.isPending || mutation.isSuccess}>
          <legend>Ingredients</legend>
          <p className={styles.hint}>
            Leave quantity blank for ingredients such as seasoning to taste.
          </p>
          {ingredients.map((entry, index) => (
            <div key={entry.key} className={styles.formRow}>
              <label className={styles.field}>
                Ingredient {index + 1}
                <input
                  value={entry.item}
                  onChange={(event) =>
                    setIngredients(
                      ingredients.map((row) =>
                        row.key === entry.key
                          ? { ...row, item: event.target.value }
                          : row,
                      ),
                    )
                  }
                  {...fieldProps(`ingredients.${index}.item`)}
                />
                {error(`ingredients.${index}.item`)}
              </label>
              <div className={styles.ingredientFields}>
                {(["quantity", "unit", "prep"] as const).map((key) => (
                  <label className={styles.field} key={key}>
                    {key === "prep" ? "Preparation" : label(key)} {index + 1}
                    <input
                      type={key === "quantity" ? "number" : "text"}
                      step={key === "quantity" ? "any" : undefined}
                      value={entry[key]}
                      onChange={(event) =>
                        setIngredients(
                          ingredients.map((row) =>
                            row.key === entry.key
                              ? { ...row, [key]: event.target.value }
                              : row,
                          ),
                        )
                      }
                      {...fieldProps(`ingredients.${index}.${key}`)}
                    />
                    {error(`ingredients.${index}.${key}`)}
                  </label>
                ))}
              </div>
              <div className={styles.actions}>
                <Button
                  type="button"
                  variant="text"
                  disabled={index === 0}
                  aria-label={`Move ingredient ${index + 1} up`}
                  onClick={() => {
                    setIngredients(move(ingredients, index, -1));
                    setDirty(true);
                  }}
                >
                  <IconArrowUp aria-hidden="true" />
                  Move up
                </Button>
                <Button
                  type="button"
                  variant="text"
                  disabled={index === ingredients.length - 1}
                  aria-label={`Move ingredient ${index + 1} down`}
                  onClick={() => {
                    setIngredients(move(ingredients, index, 1));
                    setDirty(true);
                  }}
                >
                  <IconArrowDown aria-hidden="true" />
                  Move down
                </Button>
                <Button
                  type="button"
                  variant="text-error"
                  disabled={ingredients.length === 1}
                  aria-label={`Remove ingredient ${index + 1}`}
                  onClick={() => {
                    setIngredients(
                      ingredients.filter((row) => row.key !== entry.key),
                    );
                    setDirty(true);
                  }}
                >
                  <IconTrash aria-hidden="true" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
          {error("ingredients")}
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setIngredients([...ingredients, ingredientRow()]);
              setDirty(true);
            }}
          >
            <IconCarrot aria-hidden="true" />
            Add ingredient
          </Button>
        </fieldset>
        <fieldset disabled={mutation.isPending || mutation.isSuccess}>
          <legend>Method</legend>
          {method.map((entry, index) => (
            <div key={entry.key} className={styles.formRow}>
              <label className={styles.field}>
                Step {index + 1}
                <textarea
                  rows={3}
                  value={entry.text}
                  onChange={(event) =>
                    setMethod(
                      method.map((row) =>
                        row.key === entry.key
                          ? { ...row, text: event.target.value }
                          : row,
                      ),
                    )
                  }
                  {...fieldProps(`method.${index}`)}
                />
                {error(`method.${index}`)}
              </label>
              <div className={styles.actions}>
                <Button
                  type="button"
                  variant="text"
                  disabled={index === 0}
                  aria-label={`Move step ${index + 1} up`}
                  onClick={() => {
                    setMethod(move(method, index, -1));
                    setDirty(true);
                  }}
                >
                  <IconArrowUp size={18} aria-hidden="true" />
                  Move up
                </Button>
                <Button
                  type="button"
                  variant="text"
                  disabled={index === method.length - 1}
                  aria-label={`Move step ${index + 1} down`}
                  onClick={() => {
                    setMethod(move(method, index, 1));
                    setDirty(true);
                  }}
                >
                  <IconArrowDown size={18} aria-hidden="true" />
                  Move down
                </Button>
                <Button
                  type="button"
                  variant="text-error"
                  disabled={method.length === 1}
                  aria-label={`Remove step ${index + 1}`}
                  onClick={() => {
                    setMethod(method.filter((row) => row.key !== entry.key));
                    setDirty(true);
                  }}
                >
                  <IconTrash aria-hidden="true" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
          {error("method")}
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setMethod([...method, stepRow()]);
              setDirty(true);
            }}
          >
            <IconPlus aria-hidden="true" />
            Add step
          </Button>
        </fieldset>
        {mutation.isError && (
          <p role="alert" className={styles.error}>
            Couldn’t save your recipe. Please try again.
          </p>
        )}
        <div className={styles.actions}>
          <Button
            type="submit"
            disabled={mutation.isPending || mutation.isSuccess}
          >
            {mutation.isPending ? "Saving recipe…" : "Save recipe"}
          </Button>
          <Link to="/recipes">Cancel</Link>
        </div>
      </form>
    </section>
  );
}

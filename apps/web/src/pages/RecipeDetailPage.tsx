import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { RecipeDetail } from "@nosh/contracts";
import { fetchRecipe, fetchHousehold, RecipeApiError } from "@/lib/api";
import { dietaryDisplayLabel, label } from "@/lib/recipe-navigation";
import { CuisineFlag } from "@/components/CuisineFlag";
import { Button } from "@/components/ui/button";
import styles from "./Recipes.module.css";
import { IconArrowLeft } from "@tabler/icons-react";

function RecipeContent({ recipe }: { recipe: RecipeDetail }) {
  const [servings, setServings] = useState(String(recipe.serves));
  const household = useQuery({
    queryKey: ["household"],
    queryFn: fetchHousehold,
    staleTime: Infinity,
  });
  const amount = Number(servings);
  const valid = Number.isSafeInteger(amount) && amount > 0;
  const multiplier = valid ? amount / recipe.serves : 1;
  const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
  useEffect(() => {
    document.title = `${recipe.name} | Nosh`;
  }, [recipe.name]);

  return (
    <>
      <div className={styles.heading}>
        <div>
          <h1>{recipe.name}</h1>
          <p>
            {recipe.source === "user" ? "Custom recipe" : "Nosh recipe"} ·
            Original recipe serves {recipe.serves}
          </p>
        </div>
        <CuisineFlag cuisine={recipe.cuisine} />
      </div>
      <dl className={styles.metadata}>
        <div>
          <dt>Cuisine</dt>
          <dd>{recipe.cuisine ? label(recipe.cuisine) : "Unspecified"}</dd>
        </div>
        <div>
          <dt>Meal type</dt>
          <dd>{recipe.mealType.map(label).join(", ")}</dd>
        </div>
        <div>
          <dt>Dietary labels</dt>
          <dd>
            {recipe.dietary.length
              ? recipe.dietary.map(dietaryDisplayLabel).join(", ")
              : "None supplied"}
          </dd>
        </div>
      </dl>
      {!!recipe.tags.length && (
        <ul className={styles.tags} aria-label="All recipe tags">
          {recipe.tags.map((tag) => (
            <li key={tag}>{label(tag)}</li>
          ))}
        </ul>
      )}
      <div className={styles.scaling}>
        <label className={styles.field}>
          Servings
          <input
            type="number"
            min="1"
            step="1"
            value={servings}
            aria-invalid={!valid}
            aria-describedby={!valid ? "servings-error" : undefined}
            onChange={(event) => setServings(event.target.value)}
          />
        </label>
        <Button
          variant="secondary"
          disabled={!household.data}
          onClick={() => setServings(String(household.data!.householdSize))}
        >
          Use household size
        </Button>
        <Button
          variant="text"
          onClick={() => setServings(String(recipe.serves))}
        >
          Reset to original
        </Button>
      </div>
      {!valid && (
        <p id="servings-error" className={styles.error}>
          Enter a whole number greater than zero. Showing original quantities.
        </p>
      )}
      {household.isError && (
        <p role="alert">
          Couldn’t load household size.{" "}
          <Button variant="text" onClick={() => void household.refetch()}>
            Retry household settings
          </Button>
        </p>
      )}
      <div className={styles.detailColumns}>
        <section aria-labelledby="ingredients-title">
          <h2 id="ingredients-title">Ingredients</h2>
          <ul className={styles.ingredients}>
            {recipe.ingredients.map((ingredient, index) => (
              <li key={index}>
                <span>
                  {ingredient.quantity === null
                    ? ""
                    : `${number.format(ingredient.quantity * multiplier)} `}
                  {ingredient.unit ? `${ingredient.unit} ` : ""}
                  {ingredient.item}
                  {ingredient.prep ? `, ${ingredient.prep}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="method-title">
          <h2 id="method-title">Method</h2>
          <ol className={styles.method}>
            {recipe.method.map((instruction, index) => (
              <li key={index}>{instruction}</li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}

export default function RecipeDetailPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["recipe-detail", id],
    queryFn: ({ signal }) => fetchRecipe(id, signal),
  });
  const notFound =
    query.error instanceof RecipeApiError && query.error.status === 404;
  return (
    <section className={styles.page}>
      {location.state?.fromExplorer ? (
        <Button variant="text" onClick={() => navigate(-1)}>
          <IconArrowLeft size={18} aria-hidden="true" />
          Recipes
        </Button>
      ) : (
        <Button variant="text" render={<Link to="/recipes" />}>
          <IconArrowLeft size={18} aria-hidden="true" />
          Recipes
        </Button>
      )}
      {query.isPending && <p role="status">Loading recipe…</p>}
      {query.isError && (
        <div role="alert">
          <h1>{notFound ? "Recipe not found" : "Couldn’t load recipe"}</h1>
          <p>
            {notFound
              ? "This recipe may no longer be available."
              : "Please try again."}
          </p>
          {!notFound && (
            <Button onClick={() => void query.refetch()}>Try again</Button>
          )}
        </div>
      )}
      {query.data && <RecipeContent key={query.data.id} recipe={query.data} />}
    </section>
  );
}

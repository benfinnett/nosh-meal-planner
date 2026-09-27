import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { IconArrowRight } from "@tabler/icons-react";
import { fetchCatalogue } from "@/lib/api";
import { fetchPlanner } from "@/lib/planner-api";
import { RecipeGrid, RecipeSkeleton } from "@/components/RecipeCard";
import { Button } from "@/components/ui/button";
import styles from "./HomePage.module.css";

const mealTypes = ["breakfast", "lunch", "dinner"] as const;
const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

const selectRandomRecipes = <Recipe,>(recipes: Recipe[]) => {
  const shuffled = [...recipes];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }
  return shuffled.slice(0, 6);
};

function HomePage() {
  const planner = useQuery({
    queryKey: ["planner", "overview"],
    queryFn: fetchPlanner,
  });
  const week = planner.data?.current;
  const counts = week?.coverage ?? { breakfast: 0, lunch: 0, dinner: 0 };
  const planned = mealTypes.reduce((total, type) => total + counts[type], 0);

  const recipes = useQuery({
    queryKey: ["recipe-catalogue", "home"],
    queryFn: ({ signal }) =>
      fetchCatalogue(new URLSearchParams({ limit: "100" }), signal),
    select: (data) => ({ ...data, recipes: selectRandomRecipes(data.recipes) }),
  });

  return (
    <div className={styles.page}>
      <section aria-labelledby="inspiration-title">
        <div className={styles.sectionHeading}>
          <h1 id="inspiration-title">What’s on the menu?</h1>
          <Button
            variant="text"
            nativeButton={false}
            role="link"
            render={<Link to="recipes" />}
          >
            View more
            <IconArrowRight size={18} aria-hidden="true" />
          </Button>
        </div>
        {recipes.isPending && <RecipeSkeleton />}
        {recipes.isError && (
          <div className={styles.feedMessage}>
            <p role="alert">Couldn’t load recipes. Please try again.</p>
            <Button type="button" onClick={() => void recipes.refetch()}>
              Try again
            </Button>
          </div>
        )}
        {recipes.isSuccess &&
          (recipes.data.recipes.length === 0 ? (
            <p className={styles.feedMessage}>No recipes to show yet.</p>
          ) : (
            <RecipeGrid recipes={recipes.data.recipes} />
          ))}
      </section>
      <section className={styles.coverage} aria-labelledby="coverage-title">
        <div>
          <h1 id="coverage-title">This week, at a glance</h1>
          {planner.isSuccess && (
            <>
              <h3>{planned} of 21 meal slots planned</h3>
              <p className={styles.chartNote}>
                {week
                  ? `${formatDate(week.weekStart)} – ${formatDate(week.weekEnd)}`
                  : "No active meal plan yet."}
              </p>
            </>
          )}
          <Button
            variant="text"
            nativeButton={false}
            role="link"
            render={<Link to="/plan" />}
          >
            {week ? "View meal plan" : "Create a meal plan"}
            <IconArrowRight size={18} aria-hidden="true" />
          </Button>
        </div>
        <div>
          {planner.isPending && <p role="status">Loading meal plan…</p>}
          {planner.isError && (
            <div>
              <p role="alert">
                Couldn’t load meal-plan coverage. Please try again.
              </p>
              <Button onClick={() => void planner.refetch()}>
                Retry meal plan
              </Button>
            </div>
          )}
          {planner.isSuccess && (
            <>
              <ul
                className={styles.mealBars}
                aria-label="Weekly meal-plan coverage"
              >
                {mealTypes.map((type) => {
                  const label = type[0].toUpperCase() + type.slice(1);
                  return (
                    <li key={type}>
                      <span>{label}</span>
                      <strong>
                        {counts[type]} <small>/ 7</small>
                      </strong>
                      <progress
                        aria-label={label}
                        value={counts[type]}
                        max={7}
                      />
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default HomePage;

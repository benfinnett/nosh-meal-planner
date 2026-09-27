import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { IconArrowRight } from "@tabler/icons-react";
import { fetchCatalogue } from "@/lib/api";
import { RecipeGrid, RecipeSkeleton } from "@/components/RecipeCard";
import { Button, buttonVariants } from "@/components/ui/button";
import styles from "./HomePage.module.css";

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

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
  const recipes = useQuery({
    queryKey: ["recipe-catalogue", "home"],
    queryFn: ({ signal }) =>
      fetchCatalogue(new URLSearchParams({ limit: "100" }), signal),
    select: (data) => ({ ...data, recipes: selectRandomRecipes(data.recipes) }),
  });

  return (
    <>
      <section aria-labelledby="inspiration-title">
        <div className={styles.sectionHeading}>
          <h1 id="inspiration-title">What’s on the menu?</h1>
          <Link
            to="/recipes"
            className={`${buttonVariants({ variant: "text" })} ${styles.sectionLink}`}
          >
            View more <IconArrowRight size={18} aria-hidden="true" />
          </Link>
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
          <h3>0 of 21 meal slots planned</h3>
        </div>
        <div>
          <ul className={styles.dayBars} aria-label="Weekly meal-plan coverage">
            {days.map((day) => (
              <li key={day} aria-label={`${day}: 0 of 3 meals planned`}>
                <span className={styles.barTrack} aria-hidden="true">
                  <span>B</span>
                  <span>L</span>
                  <span>D</span>
                </span>
                <abbr
                  className={styles.dayLabel}
                  title={day}
                  aria-hidden="true"
                >
                  {day.slice(0, 3)}
                </abbr>
              </li>
            ))}
          </ul>
          <p className={styles.chartLegend}>
            <span aria-hidden="true" /> Unplanned meal slot
          </p>
        </div>
      </section>
    </>
  );
}

export default HomePage;

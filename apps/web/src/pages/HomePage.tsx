import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { IconArrowRight, IconChefHat, IconUser } from "@tabler/icons-react";
import { fetchRecipeSummaries } from "@/lib/api";
import { CuisineFlag } from "@/components/CuisineFlag";
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

function HomePage() {
  const recipes = useQuery({
    queryKey: ["recipe-summaries"],
    queryFn: fetchRecipeSummaries,
  });

  return (
    <>
      <section aria-labelledby="inspiration-title">
        <div className={styles.sectionHeading}>
          <h1>What’s on the menu?</h1>
          <Link className={styles.sectionLink} to="/recipes">
            View more <IconArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
        {recipes.isPending && (
          <div role="status">
            <span className="sr-only">Loading recipes</span>
            <div className={styles.recipeGrid} aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => (
                <article className={styles.recipeCard} key={index}>
                  <div className={styles.recipeTopline}>
                    <span
                      className={`${styles.recipeSkeleton} ${styles.skeletonNumber}`}
                    />
                    <span
                      className={`${styles.recipeSkeleton} ${styles.skeletonIcons}`}
                    />
                  </div>
                  <div
                    className={`${styles.recipeSkeleton} ${styles.skeletonTitle}`}
                  />
                  <div
                    className={`${styles.recipeSkeleton} ${styles.skeletonDetails}`}
                  />
                </article>
              ))}
            </div>
          </div>
        )}
        {recipes.isError && (
          <div className={styles.feedMessage}>
            <p role="alert">Couldn’t load recipes. Please try again.</p>
            <button
              className={styles.retryButton}
              onClick={() => void recipes.refetch()}
            >
              Try again
            </button>
          </div>
        )}
        {recipes.isSuccess &&
          (recipes.data.length === 0 ? (
            <p className={styles.feedMessage}>No recipes to show yet.</p>
          ) : (
            <div className={styles.recipeGrid}>
              {recipes.data.slice(0, 6).map((recipe, index) => (
                <article className={styles.recipeCard} key={recipe.id}>
                  <div className={styles.recipeTopline}>
                    <span className={styles.recipeNumber}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className={styles.recipeCuisineIcons}>
                      <CuisineFlag cuisine={recipe.cuisine} />
                      <IconChefHat size={28} aria-hidden="true" />
                    </span>
                  </div>
                  <h3>{recipe.name}</h3>
                  <p>
                    <span
                      className={styles.recipeServings}
                      aria-label={`Serves ${recipe.serves} ${recipe.serves === 1 ? "person" : "people"}`}
                    >
                      <span
                        className={styles.recipeServingIcons}
                        aria-hidden="true"
                      >
                        {Array.from({ length: recipe.serves }, (_, person) => (
                          <IconUser key={person} size={16} />
                        ))}
                      </span>
                      <span aria-hidden="true">x{recipe.serves}</span>
                    </span>
                  </p>
                </article>
              ))}
            </div>
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

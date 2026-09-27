import { Link, useLocation } from "react-router-dom";
import { IconChefHat, IconUser } from "@tabler/icons-react";
import type { RecipeCard as RecipeCardData } from "@nosh/contracts";
import { CuisineFlag } from "./CuisineFlag";
import { explorerPositions, label } from "@/lib/recipe-navigation";
import styles from "./RecipeCard.module.css";

export function RecipeCard({
  recipe,
  index,
}: {
  recipe: RecipeCardData;
  index: number;
}) {
  const location = useLocation();
  return (
    <article className={styles.recipeCard}>
      <div className={styles.recipeTopline}>
        <p
          className={styles.recipeServings}
          aria-label={`Serves ${recipe.serves} ${recipe.serves === 1 ? "person" : "people"}`}
        >
          <span className={styles.recipeServingIcons} aria-hidden="true">
            {Array.from(
              { length: Math.min(recipe.serves, 100) },
              (_, person) => (
                <IconUser key={person} size={16} />
              ),
            )}
          </span>
          <span aria-hidden="true">x{recipe.serves}</span>
        </p>
        <span className={styles.recipeCuisineIcons}>
          <CuisineFlag cuisine={recipe.cuisine} />
          <IconChefHat size={28} aria-hidden="true" />
        </span>
      </div>
      <h3>
        <Link
          id={`recipe-${recipe.id}`}
          className={styles.cardLink}
          to={`/recipes/${recipe.id}`}
          state={
            location.pathname === "/recipes"
              ? { fromExplorer: true }
              : undefined
          }
          onClick={() => {
            if (location.pathname === "/recipes")
              explorerPositions.set(location.key, {
                scroll: window.scrollY,
                cardId: recipe.id,
              });
          }}
        >
          {recipe.name}
        </Link>
      </h3>
      {!!recipe.tags.length && (
        <ul className={styles.tags} aria-label="Recipe tags">
          {[...recipe.tags]
            .sort()
            .slice(0, 3)
            .map((tag) => (
              <li key={tag}>{label(tag)}</li>
            ))}
        </ul>
      )}
    </article>
  );
}

export function RecipeGrid({ recipes }: { recipes: RecipeCardData[] }) {
  return (
    <div className={styles.recipeGrid}>
      {recipes.map((recipe, index) => (
        <RecipeCard key={recipe.id} recipe={recipe} index={index} />
      ))}
    </div>
  );
}

export function RecipeSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status">
      <span className="sr-only">Loading recipes</span>
      <div className={styles.recipeGrid} aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
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
  );
}

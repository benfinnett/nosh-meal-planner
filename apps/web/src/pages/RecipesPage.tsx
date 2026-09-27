import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { dietaryPreferences } from "@nosh/contracts";
import { fetchCatalogue, fetchHousehold, fetchRecipeOptions } from "@/lib/api";
import {
  dietaryDisplayLabel,
  explorerPositions,
  label,
} from "@/lib/recipe-navigation";
import { RecipeGrid, RecipeSkeleton } from "@/components/RecipeCard";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import styles from "./Recipes.module.css";
import { IconBowlSpoon } from "@tabler/icons-react";

const categories = ["dietary", "cuisine", "mealType", "tags"] as const;
type Category = (typeof categories)[number];
const titles: Record<Category, string> = {
  dietary: "Dietary preferences",
  cuisine: "Cuisine",
  mealType: "Meal type",
  tags: "Tags",
};

export default function RecipesPage() {
  const [params, setParams] = useSearchParams();
  // Keep controls responsive while the data router commits its URL transition.
  const [controlParams, setControlParams] = useState(params);
  const [previousParams, setPreviousParams] = useState(params.toString());
  if (params.toString() !== previousParams) {
    setPreviousParams(params.toString());
    setControlParams(params);
  }
  const location = useLocation();
  const household = useQuery({
    queryKey: ["household"],
    queryFn: fetchHousehold,
    staleTime: Infinity,
  });
  const options = useQuery({
    queryKey: ["recipe-filter-options"],
    queryFn: fetchRecipeOptions,
  });
  const explicitDietary = params.has("dietary");
  const urlSearch = params.get("q") ?? "";
  const [search, setSearch] = useState(urlSearch);
  const [previousSearch, setPreviousSearch] = useState(urlSearch);
  if (urlSearch !== previousSearch) {
    setPreviousSearch(urlSearch);
    setSearch(urlSearch);
  }

  useEffect(() => {
    if (!explicitDietary && household.data) {
      const next = new URLSearchParams(params);
      next.delete("dietary");
      if (household.data.dietaryPreferences.length)
        household.data.dietaryPreferences.forEach((value) =>
          next.append("dietary", value),
        );
      else next.set("dietary", "");
      setParams(next, { replace: true });
    }
  }, [explicitDietary, household.data, params, setParams]);

  useEffect(() => {
    if (search === urlSearch) return;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params);
      if (search.trim()) next.set("q", search.trim());
      else next.delete("q");
      setParams(next, { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, urlSearch, params, setParams]);

  const requestParams = new URLSearchParams();
  if (urlSearch) requestParams.set("q", urlSearch);
  if (params.get("mine") === "true") requestParams.set("mine", "true");
  for (const category of categories) {
    [...new Set(params.getAll(category).filter(Boolean))]
      .sort()
      .forEach((value) => requestParams.append(category, value));
  }
  const queryString = requestParams.toString();
  const recipes = useInfiniteQuery({
    queryKey: ["recipe-catalogue", queryString],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      const query = new URLSearchParams(queryString);
      query.set("limit", "12");
      if (pageParam) query.set("cursor", pageParam);
      return fetchCatalogue(query, signal);
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: explicitDietary,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetching, isFetchNextPageError, fetchNextPage } =
    recipes;
  useEffect(() => {
    if (
      !hasNextPage ||
      isFetching ||
      isFetchNextPageError ||
      !sentinel.current ||
      !window.IntersectionObserver
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void fetchNextPage({ cancelRefetch: false });
      },
      { rootMargin: "240px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetching, isFetchNextPageError, fetchNextPage]);

  const restored = useRef(false);
  useLayoutEffect(() => {
    const position = explorerPositions.get(location.key);
    if (restored.current || !position || !recipes.data) return;
    const frame = requestAnimationFrame(() => {
      restored.current = true;
      document
        .getElementById(`recipe-${position.cardId}`)
        ?.focus({ preventScroll: true });
      window.scrollTo(0, position.scroll);
    });
    return () => cancelAnimationFrame(frame);
  }, [location.key, recipes.data]);

  function setSelection(category: Category, selected: string[]) {
    const next = new URLSearchParams(params);
    next.delete(category);
    selected.forEach((value) => next.append(category, value));
    if (category === "dietary" && !selected.length) next.set("dietary", "");
    setControlParams(next);
    setParams(next);
  }
  function filterLabel(category: Category, value: string) {
    return category === "dietary" ? dietaryDisplayLabel(value) : label(value);
  }
  function setMine(selected: boolean) {
    const next = new URLSearchParams(params);
    if (selected) next.set("mine", "true");
    else next.delete("mine");
    setControlParams(next);
    setParams(next);
  }
  const choices = {
    dietary: [...dietaryPreferences],
    cuisine: options.data?.cuisines ?? [],
    mealType: options.data?.mealTypes ?? [],
    tags: options.data?.tags ?? [],
  };
  function filters() {
    return (
      <div className={styles.filterGroups}>
        <fieldset>
          <legend>Recipe ownership</legend>
          <label className={styles.check}>
            <input
              type="checkbox"
              aria-label="My recipes"
              checked={controlParams.get("mine") === "true"}
              onChange={(event) => setMine(event.target.checked)}
            />
            My recipes
          </label>
        </fieldset>
        {categories.map((category) => (
          <fieldset key={category}>
            <legend>{titles[category]}</legend>
            {choices[category].map((value) => (
              <label key={value} className={styles.check}>
                <input
                  type="checkbox"
                  checked={controlParams.getAll(category).includes(value)}
                  onChange={(event) =>
                    setSelection(
                      category,
                      event.target.checked
                        ? [...params.getAll(category).filter(Boolean), value]
                        : params
                            .getAll(category)
                            .filter((entry) => entry !== value),
                    )
                  }
                />
                {filterLabel(category, value)}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
    );
  }
  const cards = recipes.data?.pages.flatMap((page) => page.recipes) ?? [];
  const waitingForHousehold = !explicitDietary;

  return (
    <section className={styles.page} aria-labelledby="recipes-title">
      <div className={styles.heading}>
        <div>
          <h1 id="recipes-title">Recipes</h1>
          <p>Find something for your next meal.</p>
        </div>
        <Button render={<Link to="/recipes/new" />}>
          <IconBowlSpoon />
          Create recipe
        </Button>
      </div>
      <div className={styles.desktopFilters}>{filters()}</div>
      <div className={styles.mobileFilters}>
        <Sheet>
          <SheetTrigger render={<Button variant="secondary" />}>
            Filters
          </SheetTrigger>
          <SheetContent className={styles.filterSheet}>
            <SheetTitle>Recipe filters</SheetTitle>
            <SheetDescription>
              Match any selection within each group.
            </SheetDescription>
            {filters()}
            <SheetClose render={<Button />}>Show recipes</SheetClose>
          </SheetContent>
        </Sheet>
      </div>
      <label className={styles.field}>
        Search recipes
        <input
          type="search"
          maxLength={200}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by recipe name"
        />
      </label>
      {options.isError && (
        <p role="alert">
          Couldn’t load filter options.{" "}
          <Button variant="text" onClick={() => void options.refetch()}>
            Retry filters
          </Button>
        </p>
      )}
      <div className={styles.actions}>
        {params.get("mine") === "true" && (
          <Button
            variant="secondary"
            aria-label="Remove My recipes filter"
            onClick={() => setMine(false)}
          >
            My recipes ×
          </Button>
        )}
        {categories.flatMap((category) =>
          params
            .getAll(category)
            .filter(Boolean)
            .map((value) => (
              <Button
                variant="secondary"
                key={`${category}-${value}`}
                aria-label={`Remove ${filterLabel(category, value)} filter`}
                onClick={() =>
                  setSelection(
                    category,
                    params.getAll(category).filter((entry) => entry !== value),
                  )
                }
              >
                {filterLabel(category, value)} ×
              </Button>
            )),
        )}
        <Button
          variant="text"
          onClick={() => {
            setSearch("");
            setParams({ dietary: "" });
          }}
        >
          Clear filters
        </Button>
      </div>
      {household.isError && (
        <div role="alert">
          <p>Couldn’t load household preferences.</p>
          <Button variant="secondary" onClick={() => void household.refetch()}>
            Retry household settings
          </Button>
          {waitingForHousehold && (
            <Button variant="text" onClick={() => setSelection("dietary", [])}>
              Browse without dietary defaults
            </Button>
          )}
        </div>
      )}
      {waitingForHousehold ? (
        !household.isError && <RecipeSkeleton />
      ) : (
        <>
          {recipes.isPending && <RecipeSkeleton count={12} />}
          {recipes.isError && !recipes.data && (
            <div role="alert">
              <p>Couldn’t load recipes.</p>
              <Button onClick={() => void recipes.refetch()}>Try again</Button>
            </div>
          )}
          {recipes.data && (
            <>
              {cards.length ? (
                <RecipeGrid recipes={cards} />
              ) : (
                <p>
                  No recipes match these filters. Try clearing a filter or
                  create your own recipe.
                </p>
              )}
              <div ref={sentinel} className={styles.loadMore}>
                {recipes.isFetchingNextPage && (
                  <p role="status">Loading more recipes…</p>
                )}
                {recipes.isFetchNextPageError && (
                  <p role="alert">
                    Couldn’t load more recipes. Your results are still here.
                  </p>
                )}
                {recipes.hasNextPage ? (
                  <Button
                    variant="secondary"
                    disabled={recipes.isFetching}
                    onClick={() =>
                      void recipes.fetchNextPage({ cancelRefetch: false })
                    }
                  >
                    {recipes.isFetchNextPageError
                      ? "Retry loading more"
                      : "Load more"}
                  </Button>
                ) : (
                  cards.length > 0 && (
                    <>
                      <p>
                        You’ve reached the end of the recipes. Why not create
                        your own?
                      </p>
                      <Button render={<Link to="/recipes/new" />}>
                        <IconBowlSpoon />
                        Create recipe
                      </Button>
                    </>
                  )
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

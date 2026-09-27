import { useEffect, useRef } from "react";
import HomePage from "@/pages/HomePage";
import HouseholdPage from "@/pages/HouseholdPage";
import RecipesPage from "@/pages/RecipesPage";
import RecipeDetailPage from "@/pages/RecipeDetailPage";
import CreateRecipePage from "@/pages/CreateRecipePage";
import { HouseholdProvider } from "@/HouseholdProvider";
import MealPlanPage from "@/pages/MealPlanPage";
import { SnackbarProvider } from "@/components/Snackbar";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  IconCalendarWeek,
  IconChefHat,
  IconHome,
  IconUsers,
} from "@tabler/icons-react";
import styles from "@/App.module.css";

const navigation = [
  { path: "/", label: "Home", icon: IconHome },
  { path: "/plan", label: "Meal plan", icon: IconCalendarWeek },
  { path: "/recipes", label: "Recipes", icon: IconChefHat },
  { path: "/household", label: "Household", icon: IconUsers },
];

export function App() {
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);
  const main = useRef<HTMLElement>(null);

  useEffect(() => {
    const title =
      pathname === "/recipes/new"
        ? "Create recipe"
        : pathname.startsWith("/recipes/")
          ? "Recipe"
          : pathname.startsWith("/plan")
            ? "Meal plan"
            : (navigation.find((item) => item.path === pathname)?.label ??
              "Home");
    document.title = `${title} | Nosh`;

    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
    }
  }, [pathname]);

  return (
    <SnackbarProvider>
      <HouseholdProvider>
        <header className={styles.masthead}>
          <div className={styles.mastheadContent}>
            <img
              className={styles.logoIcon}
              src="/brand/nosh-logo-icon.png"
              alt="Nosh Logo"
            />
            <img
              className={styles.logoText}
              src="/brand/nosh-logo-text.png"
              alt="Nosh — meal planning platform"
            />
            <nav className={styles.mastheadNav} aria-label="Main navigation">
              {navigation.map(({ path, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === "/"}
                  className={styles.mastheadNavLink}
                >
                  <Icon size={20} aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </header>
        <main
          id="main-content"
          className={styles.page}
          tabIndex={-1}
          ref={main}
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/plan/*" element={<MealPlanPage />} />
            <Route path="/recipes" element={<RecipesPage />} />
            <Route path="/recipes/new" element={<CreateRecipePage />} />
            <Route path="/recipes/:id" element={<RecipeDetailPage />} />
            <Route path="/household" element={<HouseholdPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <nav className={styles.bottomNav} aria-label="Main navigation (mobile)">
          <div className={styles.bottomNavItems}>
            {navigation.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/"}
                className={styles.bottomNavLink}
              >
                <Icon size={24} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </HouseholdProvider>
    </SnackbarProvider>
  );
}

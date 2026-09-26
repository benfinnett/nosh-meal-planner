import { useEffect, useRef } from "react";
import HomePage from "@/pages/HomePage";
import PlaceholderPage from "@/pages/PlaceholderPage";
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
      navigation.find((item) => item.path === pathname)?.label ?? "Home";
    document.title = `${title} | Nosh`;

    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
    }
  }, [pathname]);

  return (
    <>
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
        </div>
      </header>
      <main id="main-content" className={styles.page} tabIndex={-1} ref={main}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/plan"
            element={
              <PlaceholderPage
                title="Meal plan"
                description="Building your weekly meal plan"
              />
            }
          />
          <Route
            path="/recipes"
            element={
              <PlaceholderPage
                title="Recipes"
                description="The recipe catalogue"
              />
            }
          />
          <Route
            path="/household"
            element={
              <PlaceholderPage
                title="Household"
                description="Setting your household preferences"
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <nav className={styles.bottomNav} aria-label="Main navigation">
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
    </>
  );
}

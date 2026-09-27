import {
  dietaryPreferences,
  householdLocations,
  type Household,
} from "@nosh/contracts";
import { useHousehold } from "@/HouseholdProvider";
import { Button } from "@/components/ui/button";
import styles from "./HouseholdPage.module.css";
import { Link } from "react-router-dom";
import { IconArrowRight } from "@tabler/icons-react";

const dietLabels = {
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  "dairy-free": "Dairy-free",
  "gluten-free": "Gluten-free",
};
const locationLabels = {
  england: "England",
  wales: "Wales",
  "northern-ireland": "Northern Ireland",
  scotland: "Scotland",
  "outside-uk": "Outside the UK",
  unspecified: "Not specified",
};

export default function HouseholdPage() {
  const household = useHousehold();
  const { draft, edit } = household;

  return (
    <div className={styles.page}>
      <h1>Household</h1>
      {!draft ? (
        household.loadError ? (
          <div role="alert">
            <p>Couldn’t load household settings.</p>
            <Button type="button" onClick={() => void household.reload()}>
              Try again
            </Button>
          </div>
        ) : (
          <div
            role="status"
            aria-label="Loading household settings"
            aria-busy="true"
            className={styles.skeleton}
          >
            <span className={styles.srOnly}>Loading household settings</span>
            <div aria-hidden="true">
              <div className={styles.skeletonLine} />
              <div className={styles.skeletonControl} />
              <div className={styles.skeletonLine} />
              <div className={styles.skeletonChoices} />
              <div className={styles.skeletonLine} />
              <div className={styles.skeletonControl} />
            </div>
          </div>
        )
      ) : (
        <>
          {draft.location === "scotland" ? (
            <aside className={styles.support} aria-labelledby="support-title">
              <h3 id="support-title">Best Start Foods</h3>
              <p>
                If you're pregnant or have a child under three, you may be
                eligible for help buying healthy food and milk.
              </p>
              <p>
                The Best Start Foods scheme decides eligibility. Visit its
                website to see who can apply.
              </p>
              <Button
                variant="text"
                render={
                  <Link
                    to="https://www.mygov.scot/best-start-grant-best-start-foods"
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                Find out about Best Start Foods
                <IconArrowRight size={18} aria-hidden="true" />
              </Button>
            </aside>
          ) : (
            ["england", "wales", "northern-ireland"].includes(
              draft.location,
            ) && (
              <aside className={styles.support} aria-labelledby="support-title">
                <h3 id="support-title">NHS Healthy Start</h3>
                <p>
                  If you’re more than 10 weeks pregnant or have a child under
                  four, you may be eligible for help buying healthy food and
                  milk, plus free vitamins.
                </p>
                <p>
                  The Healthy Start scheme decides eligibility. Visit its
                  website to see who can apply.
                </p>
                <Button
                  variant="text"
                  render={
                    <Link
                      to="https://www.healthystart.nhs.uk/"
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  Find out about NHS Healthy Start
                  <IconArrowRight size={18} aria-hidden="true" />
                </Button>
              </aside>
            )
          )}
          <form onSubmit={(event) => event.preventDefault()}>
            <section className={styles.section}>
              <label className={styles.heading} htmlFor="household-size">
                How many people are in your household?
              </label>
              <div className={styles.stepper}>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="text-lg"
                  aria-label="Decrease household size"
                  disabled={
                    household.invalidSize || Number(draft.householdSize) <= 1
                  }
                  onClick={() =>
                    edit({
                      ...draft,
                      householdSize: String(Number(draft.householdSize) - 1),
                    })
                  }
                >
                  −
                </Button>
                <input
                  id="household-size"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max={Number.MAX_SAFE_INTEGER}
                  step="1"
                  value={draft.householdSize}
                  aria-invalid={household.invalidSize}
                  aria-describedby={
                    household.invalidSize ? "size-error" : undefined
                  }
                  onChange={(event) =>
                    edit({ ...draft, householdSize: event.target.value })
                  }
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="text-lg"
                  aria-label="Increase household size"
                  disabled={
                    household.invalidSize ||
                    Number(draft.householdSize) >= Number.MAX_SAFE_INTEGER
                  }
                  onClick={() =>
                    edit({
                      ...draft,
                      householdSize: String(Number(draft.householdSize) + 1),
                    })
                  }
                >
                  +
                </Button>
              </div>
              {household.invalidSize && (
                <p id="size-error" className={styles.error}>
                  Please enter a valid household size.
                </p>
              )}
            </section>
            <fieldset className={styles.section}>
              <legend className={styles.heading}>Dietary preferences</legend>
              <p>
                Choose any that apply to your whole household. Leave unchecked
                if you have no preferences.
              </p>
              <div className={styles.choices}>
                {dietaryPreferences.map((value) => (
                  <label key={value} className={styles.choice}>
                    <input
                      type="checkbox"
                      checked={draft.dietaryPreferences.includes(value)}
                      onChange={(event) =>
                        edit({
                          ...draft,
                          dietaryPreferences: event.target.checked
                            ? [...draft.dietaryPreferences, value]
                            : draft.dietaryPreferences.filter(
                                (item) => item !== value,
                              ),
                        })
                      }
                    />
                    {dietLabels[value]}
                  </label>
                ))}
              </div>
            </fieldset>
            <section className={styles.section}>
              <label className={styles.heading} htmlFor="household-location">
                Where do you live?
              </label>
              <p id="location-help">
                Optional. This helps us show food support information for your
                area.
              </p>
              <select
                id="household-location"
                value={draft.location}
                aria-describedby="location-help"
                onChange={(event) =>
                  edit({
                    ...draft,
                    location: event.target.value as Household["location"],
                  })
                }
              >
                {householdLocations.map((value) => (
                  <option key={value} value={value}>
                    {locationLabels[value]}
                  </option>
                ))}
              </select>
            </section>
          </form>
        </>
      )}
    </div>
  );
}

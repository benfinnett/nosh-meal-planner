import { IconWorld } from "@tabler/icons-react";
import { GB, CN, IN, IT, MX, TH } from "country-flag-icons/react/3x2";
import styles from "./CuisineFlag.module.css";

type CountryFlag = {
  Icon: typeof GB;
  country: string;
};

export const cuisineCountryFlags: Readonly<Record<string, CountryFlag | null>> =
  {
    british: { Icon: GB, country: "United Kingdom" },
    chinese: { Icon: CN, country: "China" },
    indian: { Icon: IN, country: "India" },
    italian: { Icon: IT, country: "Italy" },
    mexican: { Icon: MX, country: "Mexico" },
    thai: { Icon: TH, country: "Thailand" },
    // This region spans multiple countries and has no single country flag.
    mediterranean: null,
  };

export function CuisineFlag({ cuisine }: { cuisine: string }) {
  const flag = cuisineCountryFlags[cuisine.trim().toLowerCase()];

  if (!flag) {
    return (
      <span
        className={`${styles.flag} ${styles.regionalFlag}`}
        role="img"
        aria-label="Regional or unspecified cuisine"
      >
        <IconWorld size={22} aria-hidden="true" />
      </span>
    );
  }

  return (
    <span
      className={styles.flag}
      role="img"
      aria-label={`${flag.country} flag`}
    >
      <flag.Icon
        aria-hidden="true"
        focusable="false"
        preserveAspectRatio="xMidYMid slice"
      />
    </span>
  );
}

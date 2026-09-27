import { Link } from "react-router-dom";
import { IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import styles from "./PlaceholderPage.module.css";

function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className={styles.page}>
      <h1>{title}</h1>
      <p>{description} is still cooking in the kitchen.</p>
      <Button variant="text" className="mt-6" render={<Link to="/" />}>
        <IconArrowLeft size={18} aria-hidden="true" />
        Back to home
      </Button>
    </section>
  );
}

export default PlaceholderPage;

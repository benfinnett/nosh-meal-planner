import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Button } from "./button";

afterEach(cleanup);

it("supports icon-only and icon-with-text buttons with a pointer cursor", () => {
  render(
    <>
      <Button aria-label="Add" size="icon">
        <svg aria-hidden="true" />
      </Button>
      <Button size="sm">
        <svg aria-hidden="true" />
        Save
      </Button>
    </>,
  );

  const iconButton = screen.getByRole("button", { name: "Add" });
  const labeledButton = screen.getByRole("button", { name: "Save" });

  expect(iconButton).toHaveAttribute("data-size", "icon");
  expect(labeledButton).toHaveAttribute("data-size", "sm");
  expect(iconButton).toHaveClass("hover:cursor-pointer");
  expect(labeledButton).toHaveClass("hover:cursor-pointer");
});

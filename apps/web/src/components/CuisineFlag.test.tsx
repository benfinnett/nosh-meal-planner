import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CuisineFlag } from "./CuisineFlag";

afterEach(cleanup);

it.each(["mediterranean", "unknown", ""])(
  "uses a globe for %s instead of an arbitrary country",
  (cuisine) => {
    render(<CuisineFlag cuisine={cuisine} />);
    expect(
      screen.getByRole("img", { name: "Regional or unspecified cuisine" }),
    ).toBeInTheDocument();
  },
);

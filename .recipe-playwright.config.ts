import config from "./playwright.config";
export default {
  ...config,
  use: { ...config.use, baseURL: "http://127.0.0.1:5183" },
  webServer: undefined,
  workers: 1,
};

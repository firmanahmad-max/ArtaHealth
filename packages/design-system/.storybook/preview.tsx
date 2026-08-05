import type { Preview } from "@storybook/react";
import "../src/tokens.css";

/**
 * Preview global: token CSS di-load, latar & tema mengikuti design system,
 * viewport default mobile 360px (target utama produk — CONTEXT §2).
 */
const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    backgrounds: { disable: true }, // latar diatur decorator via var(--ah-bg)
    viewport: {
      viewports: {
        mobile: { name: "Mobile 360px", styles: { width: "360px", height: "760px" } },
        mobileLarge: { name: "Mobile 430px", styles: { width: "430px", height: "860px" } },
      },
      defaultViewport: "mobile",
    },
  },
  globalTypes: {
    theme: {
      description: "Tema ArtaHealth",
      defaultValue: "dark",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "dark", title: "Dark" },
          { value: "light", title: "Light" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = (context.globals.theme as string) ?? "dark";
      return (
        <div
          data-theme={theme}
          style={{
            minHeight: "100vh",
            padding: 24,
            background: "var(--ah-bg)",
            color: "var(--ah-text-primary)",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
